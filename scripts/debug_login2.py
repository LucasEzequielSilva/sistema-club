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

    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    print(f"URL: {page.url}")

    page.fill('input[type="email"]', EMAIL)
    page.fill('input[type="password"]', PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    print(f"Despues de submit: {page.url}")

    # Agregar cookie onboarding
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

    page.goto(f"{BASE_URL}/tablero")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    print(f"Tablero URL: {page.url}")
    page.screenshot(path="scripts/debug_tablero.png", full_page=True)

    # Ver que hay en la pagina
    h1 = page.locator("h1, h2").first
    print(f"Titulo: {h1.text_content() if h1.is_visible() else 'no visible'}")

    browser.close()
    print("OK")
