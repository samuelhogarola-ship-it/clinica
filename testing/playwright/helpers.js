import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = process.cwd();

const defaultConfig = {
  baseUrl: "http://localhost:3000",
  pages: ["/"],
  smoke: {
    h1Selector: "h1",
    footerSelector: "footer",
    requireH1: true,
    requireFooter: true,
    waitUntil: "domcontentloaded"
  },
  navigation: {
    enabled: true,
    navbarSelector: "nav",
    footerSelector: "footer",
    requireNavbar: true,
    requireFooter: true,
    expectedLinks: [],
    checkBrokenInternalLinks: true,
    linkScopeSelectors: ["nav", "footer"]
  },
  seo: {
    enabled: true,
    requireMetaDescription: true,
    requireCanonical: true,
    requireSingleH1: true
  },
  whatsapp: {
    enabled: false,
    selector: [
      'a[href*="wa.me/"]',
      'a[href*="api.whatsapp.com"]',
      'a[href^="whatsapp://"]'
    ].join(", ")
  },
  forms: [],
  console: {
    ignoreMessages: ["favicon.ico", "preloaded but not used", "Source Map"]
  }
};

function mergeConfig(base, overrides) {
  if (!overrides || typeof overrides !== "object") {
    return structuredClone(base);
  }

  const output = Array.isArray(base) ? [...base] : { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      continue;
    }

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      base[key] &&
      typeof base[key] === "object" &&
      !Array.isArray(base[key])
    ) {
      output[key] = mergeConfig(base[key], value);
      continue;
    }

    output[key] = value;
  }

  return output;
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveConfigModulePath() {
  const envPath = process.env.PLAYWRIGHT_STARTER_CONFIG;
  const candidates = [
    envPath ? path.resolve(rootDir, envPath) : null,
    path.join(rootDir, "playwright.starter.config.js"),
    path.join(rootDir, "testing", "playwright", "config.js"),
    path.join(moduleDir, "config.js"),
    path.join(moduleDir, "config.example.js")
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "No Playwright Starter Pack config found. Use PLAYWRIGHT_STARTER_CONFIG or create testing/playwright/config.js."
  );
}

export async function loadStarterConfig() {
  const configPath = await resolveConfigModulePath();
  const imported = await import(pathToFileURL(configPath).href);
  const rawConfig = imported.default ?? imported;
  const normalized = mergeConfig(defaultConfig, rawConfig);

  normalized.pages = Array.isArray(normalized.pages) ? normalized.pages : ["/"];
  normalized.forms = normalizeFormsConfig(normalized.forms);
  normalized.smoke = mergeConfig(defaultConfig.smoke, normalized.smoke);
  normalized.navigation = normalizeFeatureConfig(normalized.navigation, defaultConfig.navigation);
  normalized.seo = normalizeFeatureConfig(normalized.seo, defaultConfig.seo);
  normalized.whatsapp = normalizeFeatureConfig(normalized.whatsapp, defaultConfig.whatsapp);

  return normalized;
}

function normalizeFeatureConfig(feature, defaults) {
  if (feature === false) {
    return { ...defaults, enabled: false };
  }

  if (feature === true || feature == null) {
    return { ...defaults, enabled: true };
  }

  return mergeConfig({ ...defaults, enabled: true }, feature);
}

function normalizeFormsConfig(forms) {
  if (!Array.isArray(forms)) {
    return [];
  }

  return forms.map((form) => {
    if (typeof form === "string") {
      return {
        path: form,
        formSelector: "form",
        requireRequiredFields: true,
        submit: { mode: "none" }
      };
    }

    return {
      path: form.path,
      formSelector: form.formSelector ?? "form",
      requireRequiredFields: form.requireRequiredFields ?? true,
      successText: form.successText,
      successUrl: form.successUrl,
      submit: {
        mode: form.submit?.mode ?? "none",
        triggerSelector:
          form.submit?.triggerSelector ?? 'button[type="submit"], input[type="submit"]',
        urlMatcher: form.submit?.urlMatcher,
        method: form.submit?.method ?? "POST",
        status: form.submit?.status ?? 200,
        responseBody: form.submit?.responseBody ?? { ok: true },
        contentType: form.submit?.contentType ?? "application/json"
      }
    };
  });
}

export function buildPageUrl(baseUrl, routePath) {
  return new URL(routePath, ensureTrailingSlash(baseUrl)).toString();
}

function ensureTrailingSlash(baseUrl) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

export async function collectScopedLinks(page, selectors) {
  const links = new Set();

  for (const selector of selectors) {
    const scopedLinks = await page.locator(selector).evaluateAll((nodes) => {
      return nodes.flatMap((node) => {
        return Array.from(node.querySelectorAll("a[href]")).map((anchor) => ({
          href: anchor.getAttribute("href"),
          text: anchor.textContent?.trim() ?? ""
        }));
      });
    });

    for (const link of scopedLinks) {
      if (link.href) {
        links.add(JSON.stringify(link));
      }
    }
  }

  return Array.from(links, (entry) => JSON.parse(entry));
}

export function normalizeInternalUrls(baseUrl, links) {
  const base = new URL(baseUrl);
  const output = [];

  for (const link of links) {
    const href = link.href?.trim();

    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }

    const url = new URL(href, base);

    if (url.origin !== base.origin) {
      continue;
    }

    output.push({
      ...link,
      pathname: `${url.pathname}${url.search}`,
      url: url.toString()
    });
  }

  return output;
}

export function installSeriousErrorTracking(page, starterConfig, testInfo) {
  const seriousErrors = [];
  const ignoredPatterns = starterConfig.console?.ignoreMessages ?? [];

  const shouldIgnore = (message) => {
    return ignoredPatterns.some((pattern) => message.includes(pattern));
  };

  page.on("pageerror", (error) => {
    seriousErrors.push({
      kind: "pageerror",
      message: error.message
    });
  });

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    const text = message.text();

    if (shouldIgnore(text)) {
      return;
    }

    seriousErrors.push({
      kind: "console",
      message: text
    });
  });

  page.on("requestfailed", (request) => {
    if (!["document", "script", "stylesheet"].includes(request.resourceType())) {
      return;
    }

    const failureText = request.failure()?.errorText ?? "Unknown request failure";

    if (shouldIgnore(failureText) || shouldIgnore(request.url())) {
      return;
    }

    seriousErrors.push({
      kind: "requestfailed",
      message: `${request.resourceType()} ${request.url()} - ${failureText}`
    });
  });

  return async function assertNoSeriousErrors() {
    if (seriousErrors.length > 0) {
      await testInfo.attach("serious-browser-errors", {
        body: seriousErrors.map(({ kind, message }) => `[${kind}] ${message}`).join("\n"),
        contentType: "text/plain"
      });
    }

    return seriousErrors;
  };
}

export async function fillRequiredFields(form) {
  const fields = form.locator(
    'input[required], textarea[required], select[required], [aria-required="true"]'
  );
  const count = await fields.count();

  for (let index = 0; index < count; index += 1) {
    const field = fields.nth(index);
    const tagName = await field.evaluate((node) => node.tagName.toLowerCase());
    const inputType =
      tagName === "input"
        ? await field.evaluate((node) => node.getAttribute("type")?.toLowerCase() ?? "text")
        : tagName;

    if (inputType === "checkbox" || inputType === "radio") {
      await field.check();
      continue;
    }

    if (tagName === "select") {
      const optionValue = await field.evaluate((node) => {
        const select = node;
        const fallback = Array.from(select.options).find((option) => !option.disabled && option.value);
        return fallback?.value ?? select.options[0]?.value ?? "";
      });

      await field.selectOption(optionValue);
      continue;
    }

    if (inputType === "email") {
      await field.fill(`playwright-${Date.now()}@example.com`);
      continue;
    }

    if (inputType === "tel") {
      await field.fill("600123123");
      continue;
    }

    if (inputType === "url") {
      await field.fill("https://example.com");
      continue;
    }

    if (inputType === "number") {
      await field.fill("1");
      continue;
    }

    if (tagName === "textarea") {
      await field.fill("Mensaje de prueba desde Playwright Starter Pack.");
      continue;
    }

    await field.fill(`Playwright Test ${index + 1}`);
  }
}

export async function submitConfiguredForm(page, form, formConfig) {
  const trigger = form.locator(formConfig.submit.triggerSelector).first();
  const submitPromises = [];

  await trigger.waitFor({ state: "visible" });

  if (formConfig.submit.mode === "stub" && formConfig.submit.urlMatcher) {
    await page.route(formConfig.submit.urlMatcher, async (route) => {
      if (route.request().method() !== formConfig.submit.method) {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: formConfig.submit.status,
        contentType: formConfig.submit.contentType,
        body: JSON.stringify(formConfig.submit.responseBody)
      });
    });
  }

  if (formConfig.submit.urlMatcher) {
    submitPromises.push(
      page.waitForResponse((response) => {
        const matcher = formConfig.submit.urlMatcher;
        const requestMatches =
          typeof matcher === "string"
            ? response.url().includes(matcher.replaceAll("*", ""))
            : matcher.test(response.url());

        return requestMatches && response.request().method() === formConfig.submit.method;
      })
    );
  }

  if (formConfig.successUrl) {
    submitPromises.push(page.waitForURL((url) => url.toString().includes(formConfig.successUrl)));
  }

  if (submitPromises.length > 0) {
    await Promise.all([trigger.click(), ...submitPromises]);
  } else {
    await trigger.click();
  }

  if (formConfig.successText) {
    await page.getByText(formConfig.successText, { exact: false }).first().waitFor();
  }
}
