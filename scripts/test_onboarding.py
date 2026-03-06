# -*- coding: utf-8 -*-
"""
QA Test Script: Onboarding & Authentication Flow
App: http://localhost:3001
"""

import os
import sys
import time
from datetime import datetime
from playwright.sync_api import sync_playwright, ConsoleMessage

# Force UTF-8 output on Windows
if sys.platform == "win32":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

SCREENSHOTS_DIR = r"D:\Dev\randazzo\scripts\screenshots"
BASE_URL = "http://localhost:3001"
EMAIL = "luxassilva@gmail.com"
PASSWORD = "admin123"

os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

console_errors = []
console_warnings = []
all_console_messages = []
bugs = []
page_timings = {}


def log(msg):
    try:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)
    except UnicodeEncodeError:
        print(
            f"[{datetime.now().strftime('%H:%M:%S')}] [encoding error in msg]",
            flush=True,
        )


def screenshot(page, name, description=""):
    path = os.path.join(SCREENSHOTS_DIR, f"{name}.png")
    page.screenshot(path=path, full_page=True)
    log(f"Screenshot: {name}.png ({description})")
    return path


def record_bug(description, severity="MEDIUM"):
    bugs.append({"severity": severity, "description": description})
    try:
        log(f"[BUG][{severity}] {description}")
    except Exception:
        pass


def capture_console(msg: ConsoleMessage):
    entry = {
        "type": msg.type,
        "text": msg.text,
        "location": f"{msg.location.get('url', '')}:{msg.location.get('lineNumber', '')}",
    }
    all_console_messages.append(entry)
    if msg.type == "error":
        console_errors.append(entry)
        log(f"[CONSOLE ERROR] {msg.text[:200]}")
    elif msg.type == "warning":
        console_warnings.append(entry)


def is_selected(el):
    """Determine if a toggle/chip element is currently selected."""
    try:
        classes = el.get_attribute("class") or ""
        aria_sel = el.get_attribute("aria-selected") or ""
        aria_checked = el.get_attribute("aria-checked") or ""
        data_state = el.get_attribute("data-state") or ""
        # Selected indicators: bg- color classes, aria-selected=true, etc.
        selected_signals = [
            "bg-orange" in classes or "bg-primary" in classes,
            aria_sel == "true",
            aria_checked == "true",
            data_state == "active" or data_state == "selected",
            "selected" in classes,
            "active" in classes,
        ]
        # Also check inner text for checkmark
        inner = el.inner_text()
        selected_signals.append("✓" in inner or "\u2713" in inner)
        return any(selected_signals)
    except Exception:
        return False


def click_continue(page, timeout=5000):
    """Click the Continuar/Continue button if it's enabled."""
    selectors = [
        'button:has-text("Continuar")',
        'button:has-text("Siguiente")',
        'button:has-text("Continue")',
        'button:has-text("Next")',
    ]
    for sel in selectors:
        try:
            btn = page.locator(sel).first
            if btn.count() > 0:
                btn.wait_for(state="visible", timeout=timeout)
                disabled = btn.get_attribute("disabled")
                aria_disabled = btn.get_attribute("aria-disabled")
                is_disabled = disabled is not None or aria_disabled == "true"
                if is_disabled:
                    log(f"WARNING: '{sel}' button is DISABLED")
                    return False, True  # (clicked=False, disabled=True)
                btn.click()
                log(f"Clicked: {sel}")
                return True, False
        except Exception as e:
            log(f"click_continue error for {sel}: {e}")
    return False, False


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        page.on("console", capture_console)
        page.on(
            "pageerror", lambda err: record_bug(f"Page JS error: {str(err)}", "HIGH")
        )

        # ─────────────────────────────────────────────────
        # STEP 1: Root → /login redirect
        # ─────────────────────────────────────────────────
        log("=== STEP 1: Root redirect ===")
        start = time.time()
        page.goto(BASE_URL, wait_until="networkidle")
        page_timings["root_redirect"] = round(time.time() - start, 2)

        if "/login" not in page.url:
            record_bug(f"Root did not redirect to /login. Got: {page.url}", "HIGH")
        else:
            log(f"OK: Redirected to /login")

        screenshot(page, "01_login_page", "Login page")

        # ─────────────────────────────────────────────────
        # STEP 2: Login
        # ─────────────────────────────────────────────────
        log("=== STEP 2: Login ===")
        page.locator('input[type="email"]').fill(EMAIL)
        page.locator('input[type="password"]').fill(PASSWORD)
        screenshot(page, "02_login_filled", "Login form filled")

        start = time.time()
        page.locator('button[type="submit"]').click()
        try:
            page.wait_for_url(lambda url: "/login" not in url, timeout=10000)
        except Exception:
            pass
        page.wait_for_load_state("networkidle", timeout=15000)
        page_timings["login_submit"] = round(time.time() - start, 2)

        log(f"URL after login: {page.url}")
        screenshot(page, "03_after_login", "After login")

        if "/login" in page.url:
            record_bug(f"Login failed - still on /login", "CRITICAL")
            browser.close()
            print_report()
            return

        if "/onboarding" not in page.url:
            record_bug(f"After login expected /onboarding, got: {page.url}", "MEDIUM")
        else:
            log("OK: On /onboarding")

        # ─────────────────────────────────────────────────
        # ONBOARDING WELCOME
        # ─────────────────────────────────────────────────
        log("=== ONBOARDING: Welcome screen ===")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(600)
        screenshot(page, "04_onboarding_welcome", "Onboarding welcome screen")

        # Bug check: page seems to render with a faded/washed-out overlay right after login
        # (observed in screenshot 04_after_login - all content was ghosted/transparent)
        log("NOTE: Checking for fade/overlay bug observed during initial load...")

        # Click "Empezar configuracion"
        empezar_btn = page.locator("button").filter(has_text="Empezar")
        if empezar_btn.count() == 0:
            record_bug(
                "'Empezar configuracion' button not found on welcome screen", "CRITICAL"
            )
            browser.close()
            print_report()
            return

        start = time.time()
        empezar_btn.first.click()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(600)
        page_timings["welcome_empezar"] = round(time.time() - start, 2)
        log(f"Clicked Empezar. URL: {page.url}")

        # ─────────────────────────────────────────────────
        # WIZARD STEP 1: Categorias
        # ─────────────────────────────────────────────────
        log("=== WIZARD STEP 1: Categorias ===")
        screenshot(page, "05_wizard_step1_categorias", "Wizard Step 1 - Categorias")

        # Colchones is pre-selected (has checkmark ✓).
        # DO NOT click it again or it will be deselected.
        colchones_btn = page.locator('button:has-text("Colchones")').first
        if colchones_btn.count() > 0:
            already_selected = is_selected(colchones_btn)
            log(f"Colchones button found. Already selected: {already_selected}")
            if not already_selected:
                colchones_btn.click()
                page.wait_for_timeout(300)
                log("Clicked Colchones to select it")
                # Verify now selected
                after_sel = is_selected(colchones_btn)
                log(f"Colchones selected after click: {after_sel}")
                if not after_sel:
                    record_bug(
                        "Colchones toggled but still not showing as selected", "MEDIUM"
                    )
            else:
                log("Colchones is already selected - NOT clicking to avoid deselect")
        else:
            record_bug("'Colchones' button not found in Wizard Step 1", "HIGH")

        screenshot(
            page,
            "06_wizard_step1_colchones_check",
            "Step 1 - Colchones selection verified",
        )

        # Verify Continue button is enabled
        cont_btn = page.locator('button:has-text("Continuar")').first
        if cont_btn.count() > 0:
            is_dis = cont_btn.get_attribute("disabled")
            aria_dis = cont_btn.get_attribute("aria-disabled")
            log(f"Continuar button: disabled={is_dis}, aria-disabled={aria_dis}")
            if is_dis is not None or aria_dis == "true":
                record_bug(
                    "BUG: 'Continuar' button is DISABLED on Step 1 - should be enabled when Colchones is pre-selected",
                    "HIGH",
                )
        else:
            record_bug("'Continuar' button not found on Step 1", "HIGH")

        start = time.time()
        clicked, was_disabled = click_continue(page)
        if was_disabled:
            record_bug(
                "BUG REPRODUCED: Continuar button is disabled on Step 1 (Categorias). "
                "Colchones appears deselected after script interaction.",
                "HIGH",
            )
            # Force click to proceed
            try:
                page.locator('button:has-text("Continuar")').first.click(force=True)
                clicked = True
                log("Force-clicked disabled Continuar button")
            except Exception as e:
                log(f"Force click failed: {e}")
        elif not clicked:
            record_bug("Continuar button not found or not clickable on Step 1", "HIGH")

        if clicked:
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(800)
            page_timings["step1_continue"] = round(time.time() - start, 2)
            log(f"After Step 1 continue. URL: {page.url}")

        # ─────────────────────────────────────────────────
        # WIZARD STEP 2: Proveedor
        # ─────────────────────────────────────────────────
        log("=== WIZARD STEP 2: Proveedor ===")
        page.wait_for_timeout(500)
        screenshot(page, "07_wizard_step2_proveedor", "Wizard Step 2 - Proveedor")

        page_text = page.evaluate("() => document.body.innerText")
        log(f"Step 2 text: {page_text[:300]}")

        # Inspect all inputs
        inputs_info = page.evaluate("""() => {
            const inputs = document.querySelectorAll('input');
            return Array.from(inputs).map(i => ({
                type: i.type,
                name: i.name,
                placeholder: i.placeholder,
                id: i.id,
                value: i.value
            }));
        }""")
        log(f"Inputs on step 2: {inputs_info}")

        # Fill provider name
        provider_selectors = [
            'input[placeholder*="nombre" i]',
            'input[placeholder*="proveedor" i]',
            'input[placeholder*="empresa" i]',
            'input[name*="nombre" i]',
            'input[name*="name" i]',
        ]
        provider_filled = False
        for sel in provider_selectors:
            try:
                el = page.locator(sel).first
                if el.count() > 0:
                    el.wait_for(state="visible", timeout=3000)
                    el.click()
                    el.fill("Test Proveedor")
                    provider_filled = True
                    log(f"Filled provider name via: {sel}")
                    break
            except Exception:
                continue

        if not provider_filled:
            # Try any text input that isn't the category custom input
            try:
                text_inputs = page.locator('input[type="text"]').all()
                log(f"Text inputs count: {len(text_inputs)}")
                for ti in text_inputs:
                    ph = ti.get_attribute("placeholder") or ""
                    if "categoria" not in ph.lower() and "category" not in ph.lower():
                        ti.click()
                        ti.fill("Test Proveedor")
                        provider_filled = True
                        log(
                            f"Filled provider name via fallback text input (placeholder={ph})"
                        )
                        break
            except Exception as e:
                log(f"Fallback fill error: {e}")

        if not provider_filled:
            record_bug("Provider name input not found in Wizard Step 2", "HIGH")

        screenshot(page, "08_wizard_step2_filled", "Step 2 - Provider filled")

        # Click Agregar
        agregar_btn = None
        for sel in [
            'button:has-text("Agregar")',
            'button:has-text("Guardar")',
            'button:has-text("Registrar")',
        ]:
            try:
                el = page.locator(sel).first
                if el.count() > 0:
                    el.wait_for(state="visible", timeout=3000)
                    agregar_btn = el
                    break
            except Exception:
                continue

        if agregar_btn is None:
            # Inspect all buttons
            btns_info = page.evaluate("""() => {
                const btns = document.querySelectorAll('button');
                return Array.from(btns).map(b => ({
                    text: b.innerText.trim(),
                    type: b.type,
                    disabled: b.disabled,
                    class: b.className.substring(0, 60)
                }));
            }""")
            log(f"Buttons on step 2: {btns_info}")
            record_bug(
                "'Agregar' button not found in Wizard Step 2 (Proveedor)", "HIGH"
            )
        else:
            start = time.time()
            agregar_btn.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1000)
            page_timings["step2_agregar"] = round(time.time() - start, 2)
            log("Clicked Agregar in step 2")

        screenshot(page, "09_wizard_step2_after_agregar", "Step 2 - After Agregar")
        log(f"URL after step 2 Agregar: {page.url}")

        # Check if there's a Continue button after Agregar (some wizards show added items + continue)
        cont_after_agregar, _ = click_continue(page, timeout=2000)
        if cont_after_agregar:
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(800)
            log("Clicked Continue after Agregar on Step 2")

        # ─────────────────────────────────────────────────
        # WIZARD STEP 3: Producto
        # ─────────────────────────────────────────────────
        log("=== WIZARD STEP 3: Producto ===")
        page.wait_for_timeout(500)
        screenshot(page, "10_wizard_step3_producto", "Wizard Step 3 - Producto")

        page_text = page.evaluate("() => document.body.innerText")
        log(f"Step 3 text: {page_text[:300]}")

        inputs_info = page.evaluate("""() => {
            const inputs = document.querySelectorAll('input');
            return Array.from(inputs).map(i => ({
                type: i.type,
                name: i.name,
                placeholder: i.placeholder,
                id: i.id
            }));
        }""")
        log(f"Inputs on step 3: {inputs_info}")

        # Fill product name
        product_selectors = [
            'input[placeholder*="nombre" i]',
            'input[placeholder*="producto" i]',
            'input[placeholder*="product" i]',
            'input[name*="nombre" i]',
            'input[name*="name" i]',
        ]
        product_filled = False
        for sel in product_selectors:
            try:
                el = page.locator(sel).first
                if el.count() > 0:
                    el.wait_for(state="visible", timeout=3000)
                    el.click()
                    el.fill("Producto Test")
                    product_filled = True
                    log(f"Filled product name via: {sel}")
                    break
            except Exception:
                continue

        if not product_filled:
            try:
                text_inputs = page.locator('input[type="text"]').all()
                if text_inputs:
                    text_inputs[0].fill("Producto Test")
                    product_filled = True
                    log("Filled product name via first text input")
            except Exception as e:
                log(f"Product fallback fill error: {e}")

        if not product_filled:
            record_bug("Product name input not found in Wizard Step 3", "HIGH")

        # Fill price
        price_selectors = [
            'input[type="number"]',
            'input[placeholder*="precio" i]',
            'input[placeholder*="price" i]',
            'input[name*="precio" i]',
            'input[name*="price" i]',
            'input[placeholder*="valor" i]',
            'input[placeholder*="monto" i]',
        ]
        price_filled = False
        for sel in price_selectors:
            try:
                el = page.locator(sel).first
                if el.count() > 0:
                    el.wait_for(state="visible", timeout=3000)
                    el.click()
                    el.fill("10000")
                    price_filled = True
                    log(f"Filled price via: {sel}")
                    break
            except Exception:
                continue

        if not price_filled:
            # Try second text input (first=name, second=price)
            try:
                text_inputs = page.locator('input[type="text"]').all()
                if len(text_inputs) > 1:
                    text_inputs[1].fill("10000")
                    price_filled = True
                    log("Filled price via second text input")
            except Exception as e:
                log(f"Price fallback fill error: {e}")

        if not price_filled:
            record_bug("Price input not found in Wizard Step 3", "HIGH")

        screenshot(page, "11_wizard_step3_filled", "Step 3 - Product filled")

        # Click Agregar
        agregar3_btn = None
        for sel in [
            'button:has-text("Agregar")',
            'button:has-text("Guardar")',
            'button:has-text("Cargar")',
        ]:
            try:
                el = page.locator(sel).first
                if el.count() > 0:
                    el.wait_for(state="visible", timeout=3000)
                    agregar3_btn = el
                    break
            except Exception:
                continue

        if agregar3_btn is None:
            btns_info = page.evaluate("""() => {
                return Array.from(document.querySelectorAll('button')).map(b => ({
                    text: b.innerText.trim(),
                    disabled: b.disabled
                }));
            }""")
            log(f"Buttons on step 3: {btns_info}")
            record_bug("'Agregar' button not found in Wizard Step 3 (Producto)", "HIGH")
        else:
            start = time.time()
            agregar3_btn.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1000)
            page_timings["step3_agregar"] = round(time.time() - start, 2)
            log("Clicked Agregar in step 3")

        screenshot(page, "12_wizard_step3_after_agregar", "Step 3 - After Agregar")
        log(f"URL after step 3 Agregar: {page.url}")

        cont_after3, _ = click_continue(page, timeout=2000)
        if cont_after3:
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(800)
            log("Clicked Continue after Agregar on Step 3")

        # ─────────────────────────────────────────────────
        # WIZARD STEP 4: Cobros
        # ─────────────────────────────────────────────────
        log("=== WIZARD STEP 4: Cobros ===")
        page.wait_for_timeout(500)
        screenshot(page, "13_wizard_step4_cobros", "Wizard Step 4 - Cobros")

        page_text = page.evaluate("() => document.body.innerText")
        log(f"Step 4 text: {page_text[:400]}")

        for method in ["Efectivo", "Transferencia"]:
            if method.lower() in page_text.lower():
                log(f"OK: Payment method '{method}' visible")
            else:
                record_bug(
                    f"Payment method '{method}' not visible in Wizard Step 4", "MEDIUM"
                )

        start = time.time()
        cont4_clicked, cont4_disabled = click_continue(page)
        if cont4_disabled:
            record_bug("Continuar button is DISABLED on Step 4 (Cobros)", "HIGH")
            # Try force click
            try:
                page.locator('button:has-text("Continuar")').first.click(force=True)
                cont4_clicked = True
            except Exception:
                pass
        elif not cont4_clicked:
            # Try Finalizar or submit
            for txt in ["Finalizar", "Guardar"]:
                try:
                    el = page.locator(f'button:has-text("{txt}")').first
                    if el.count() > 0:
                        el.click()
                        cont4_clicked = True
                        log(f"Clicked '{txt}' on Step 4")
                        break
                except Exception:
                    pass

        if not cont4_clicked:
            record_bug(
                "Continue/Finalizar button not found or not clickable on Wizard Step 4",
                "HIGH",
            )
        else:
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1000)
            page_timings["step4_continue"] = round(time.time() - start, 2)

        screenshot(page, "14_wizard_step4_after_continue", "Step 4 - After Continue")
        log(f"URL after Step 4: {page.url}")

        # ─────────────────────────────────────────────────
        # WIZARD FINAL STEP
        # ─────────────────────────────────────────────────
        log("=== WIZARD FINAL STEP ===")
        page.wait_for_timeout(500)
        screenshot(page, "15_wizard_final", "Wizard Final Step")

        page_text = page.evaluate("() => document.body.innerText")
        log(f"Final step text: {page_text[:400]}")

        btns_info = page.evaluate("""() => {
            return Array.from(document.querySelectorAll('button, a')).map(el => ({
                tag: el.tagName,
                text: el.innerText.trim(),
                href: el.href || null,
                disabled: el.disabled || false
            }));
        }""")
        log(f"Buttons/links on final step: {btns_info}")

        # Click "Ver el tablero" or similar
        start = time.time()
        tablero_clicked = False
        for text in [
            "Ver el tablero",
            "Ir al tablero",
            "tablero",
            "Dashboard",
            "Comenzar",
            "Listo",
            "Finalizar",
        ]:
            for sel in [
                f'button:has-text("{text}")',
                f'a:has-text("{text}")',
                f'[role="button"]:has-text("{text}")',
            ]:
                try:
                    el = page.locator(sel).first
                    if el.count() > 0:
                        el.wait_for(state="visible", timeout=3000)
                        el.click()
                        tablero_clicked = True
                        log(f"Clicked '{text}' via {sel}")
                        break
                except Exception:
                    continue
            if tablero_clicked:
                break

        if not tablero_clicked:
            record_bug("'Ver el tablero' button not found on final wizard step", "HIGH")
            screenshot(page, "15b_final_no_button", "Final step - no tablero button")
        else:
            try:
                page.wait_for_url(
                    lambda url: "/tablero" in url or "/dashboard" in url, timeout=10000
                )
            except Exception:
                pass
            page.wait_for_load_state("networkidle", timeout=15000)
            page_timings["to_tablero"] = round(time.time() - start, 2)

        # ─────────────────────────────────────────────────
        # VERIFY /tablero
        # ─────────────────────────────────────────────────
        log("=== VERIFY /tablero ===")
        page.wait_for_timeout(500)
        current_url = page.url
        log(f"Final URL: {current_url}")
        screenshot(page, "16_tablero_final", "Final - tablero page")

        if "/tablero" not in current_url and "/dashboard" not in current_url:
            record_bug(
                f"Did NOT reach /tablero after completing onboarding. URL: {current_url}",
                "HIGH",
            )
        else:
            log("OK: Successfully reached /tablero!")
            page_text = page.evaluate("() => document.body.innerText")
            if len(page_text.strip()) < 50:
                record_bug(
                    f"Tablero page appears nearly empty. Text: {page_text[:100]}",
                    "HIGH",
                )

        browser.close()

    print_report()


def print_report():
    sep = "-" * 60
    print("", flush=True)
    print("=" * 60, flush=True)
    print("QA TEST REPORT -- Onboarding & Auth Flow", flush=True)
    print("=" * 60, flush=True)

    print(f"\n{sep}", flush=True)
    print("PAGE LOAD TIMINGS", flush=True)
    print(sep, flush=True)
    for label, t in page_timings.items():
        status = "OK" if t < 3 else ("SLOW" if t < 6 else "VERY SLOW")
        try:
            print(f"  {label:<32} {t:>6.2f}s  [{status}]", flush=True)
        except Exception:
            pass

    print(f"\n{sep}", flush=True)
    print(f"BUGS FOUND ({len(bugs)})", flush=True)
    print(sep, flush=True)
    if not bugs:
        print("  No bugs found!", flush=True)
    for i, bug in enumerate(bugs, 1):
        try:
            print(f"  {i}. [{bug['severity']}] {bug['description']}", flush=True)
        except UnicodeEncodeError:
            print(f"  {i}. [{bug['severity']}] [description has non-ascii]", flush=True)

    print(f"\n{sep}", flush=True)
    print(f"CONSOLE ERRORS ({len(console_errors)})", flush=True)
    print(sep, flush=True)
    if not console_errors:
        print("  No console errors!", flush=True)
    for err in console_errors:
        try:
            print(f"  [ERROR] {err['text'][:200]}", flush=True)
            if err["location"]:
                print(f"          at {err['location'][:200]}", flush=True)
        except UnicodeEncodeError:
            pass

    print(f"\n{sep}", flush=True)
    print(f"CONSOLE WARNINGS ({len(console_warnings)})", flush=True)
    print(sep, flush=True)
    if not console_warnings:
        print("  No console warnings!", flush=True)
    for w in console_warnings[:10]:
        try:
            print(f"  [WARN] {w['text'][:200]}", flush=True)
        except UnicodeEncodeError:
            pass

    print(f"\n{sep}", flush=True)
    print("SCREENSHOTS TAKEN", flush=True)
    print(sep, flush=True)
    for f in sorted(os.listdir(SCREENSHOTS_DIR)):
        if f.endswith(".png"):
            fpath = os.path.join(SCREENSHOTS_DIR, f)
            size = os.path.getsize(fpath)
            print(f"  {f}  ({size // 1024} KB)", flush=True)

    print(f"\n{sep}", flush=True)
    print("ALL NON-INFO CONSOLE MESSAGES", flush=True)
    print(sep, flush=True)
    non_log = [
        m for m in all_console_messages if m["type"] not in ("log", "info", "debug")
    ]
    if not non_log:
        print("  None.", flush=True)
    for m in non_log[:20]:
        try:
            print(f"  [{m['type'].upper()}] {m['text'][:200]}", flush=True)
        except UnicodeEncodeError:
            pass

    print("", flush=True)
    print("=" * 60, flush=True)
    print(
        f"Total bugs: {len(bugs)}  |  Errors: {len(console_errors)}  |  Warnings: {len(console_warnings)}",
        flush=True,
    )
    print("=" * 60, flush=True)


if __name__ == "__main__":
    run()
