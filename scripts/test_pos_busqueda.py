import sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from playwright.sync_api import sync_playwright

BASE_URL = "https://randazzo.vercel.app"
EMAIL = "luxassilva@gmail.com"
PASSWORD = "admin123"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    page = ctx.new_page()

    # Capturar errores de red y consola
    network_errors = []
    console_errors = []
    page.on(
        "response",
        lambda r: (
            network_errors.append(f"{r.status} {r.url}") if r.status >= 400 else None
        ),
    )
    page.on(
        "console",
        lambda m: (
            console_errors.append(f"[{m.type}] {m.text}")
            if m.type in ("error", "warn")
            else None
        ),
    )

    # Login
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.locator('input[type="email"]').first.fill(EMAIL)
    page.locator('input[type="password"]').first.fill(PASSWORD)
    page.locator('button[type="submit"]').first.click(force=True)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    ctx.add_cookies(
        [
            {
                "name": "sc_onboarding_done",
                "value": "1",
                "domain": "randazzo.vercel.app",
                "path": "/",
            }
        ]
    )

    page.goto(f"{BASE_URL}/pos")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    # Buscar en el campo correcto
    search = page.locator("input[placeholder*='barras']").first
    print(f"Campo busqueda visible: {search.is_visible()}")

    search.click()
    search.fill("a")
    page.wait_for_timeout(3000)
    page.screenshot(path="scripts/pos_busqueda_a.png", full_page=True)

    # Ver que aparecio
    page_text = page.locator("body").inner_text()
    print(f"\nTexto de la pagina despues de buscar 'a':")
    print(page_text[:1000])

    print(f"\nErrores de red: {network_errors}")
    print(f"Errores de consola: {console_errors[:10]}")

    # Buscar elementos que parezcan resultados
    for selector in [
        "[role=option]",
        "[role=listbox]",
        "li",
        "[class*='result']",
        "[class*='product']",
        "[class*='item']",
    ]:
        count = page.locator(selector).count()
        if count > 0:
            print(f"Selector '{selector}': {count} elementos")

    browser.close()
