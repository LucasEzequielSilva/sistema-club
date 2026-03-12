# -*- coding: utf-8 -*-
"""
QA Test Script - Ferreteria El Tornillo
Tests the complete flow for the ferreteria@test.com account.
"""

import sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# ── Config ────────────────────────────────────────────────────────────────────
BASE_URL = "http://localhost:3001"
EMAIL = "ferreteria@test.com"
PASSWORD = "test123"
SCREENSHOTS_DIR = Path(r"D:\Dev\randazzo\scripts\screenshots\ferreteria")
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

results = []
screenshots_saved = []


def ss(page, name, desc=""):
    """Save a screenshot."""
    path = SCREENSHOTS_DIR / name
    page.screenshot(path=str(path), full_page=True)
    screenshots_saved.append(name)
    print("  [SS] %s" % name)


def log(step, passed, detail=""):
    status = "[PASS]" if passed else "[FAIL]"
    results.append({"step": step, "passed": passed, "detail": detail})
    msg = "%s %s" % (status, step)
    if detail:
        msg += " - %s" % detail
    print(msg)


def nav(page, href):
    """Navigate via direct URL."""
    page.goto(BASE_URL + href, timeout=15000)
    page.wait_for_load_state("networkidle", timeout=20000)
    page.wait_for_timeout(1000)


def search_and_add_product(page, search_term, exact_match=None):
    """
    Search for a product in POS and click the exact result.
    Returns True if a product was added to cart.
    """
    search_input = page.locator("input[type='text']").first
    search_input.clear()
    search_input.fill(search_term)
    page.wait_for_timeout(2000)

    # Take screenshot after search
    ss(page, "pos_search_%s.png" % search_term.lower().replace(" ", "_"))

    # The results are shown as buttons. Click the exact one.
    if exact_match:
        # Click button that has the exact product name text
        btn = page.locator("button:has-text('%s')" % exact_match).first
        if btn.is_visible(timeout=5000):
            btn.click()
            page.wait_for_timeout(1500)
            return True
    else:
        # Click first result button that has the search term
        btn = page.locator("button:has-text('%s')" % search_term).first
        if btn.is_visible(timeout=5000):
            btn.click()
            page.wait_for_timeout(1500)
            return True

    return False


def select_price_list(page, list_name):
    """Select a price list in POS. Returns True if selected."""
    try:
        # The price list is shown as a button with the current list name
        # and clicking it shows a dropdown/list of options
        price_btn = page.locator(
            "button:has-text('Mostrador'), button:has-text('Default')"
        ).first
        if price_btn.is_visible(timeout=3000):
            # Check if the list is already selected
            if list_name.lower() in price_btn.inner_text().lower():
                return True
            price_btn.click()
            page.wait_for_timeout(500)
            # Now click on the desired list
            page.click("text=%s" % list_name, timeout=5000)
            page.wait_for_timeout(500)
            return True
    except:
        pass

    # Also try clicking Minorista or Constructoras as direct buttons
    try:
        page.click("button:has-text('%s')" % list_name, timeout=3000)
        return True
    except:
        pass

    # Try text= selector in any visible element
    try:
        page.click("text=%s" % list_name, timeout=3000)
        return True
    except:
        pass

    return False


def complete_pos_sale(page, payment_method="Efectivo"):
    """
    Complete a POS sale. Clicks the payment method button then Confirmar Venta.
    Returns True if the confirmation button was clicked.
    """
    # Select payment method (buttons like "Efectivo", "Transferencia", etc.)
    try:
        pay_btn = page.locator("button:has-text('%s')" % payment_method).first
        if pay_btn.is_visible(timeout=3000):
            pay_btn.click()
            page.wait_for_timeout(500)
            print("  Clicked payment method: %s" % payment_method)
    except Exception as e:
        print("  Payment method click error: %s" % e)

    # Click "Confirmar Venta" - try multiple approaches
    # 1. Using has-text (partial match)
    try:
        confirm_btn = page.locator("button:has-text('Confirmar Venta')").first
        visible = confirm_btn.is_visible(timeout=5000)
        print("  Confirmar Venta visible: %s" % visible)
        if visible:
            confirm_btn.click(timeout=5000)
            print("  Clicked Confirmar Venta")
            # Wait for result - POS may show a confirmation overlay
            try:
                page.wait_for_load_state("networkidle", timeout=10000)
            except:
                pass
            page.wait_for_timeout(2000)
            return True
    except Exception as e:
        print("  Confirmar Venta click error: %s" % e)

    # 2. Force click by JS
    try:
        page.evaluate("""
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find(b => b.textContent.includes('Confirmar Venta'));
            if (btn) btn.click();
        """)
        page.wait_for_timeout(2000)
        try:
            page.wait_for_load_state("networkidle", timeout=10000)
        except:
            pass
        body = page.inner_text("body")
        if "registrada" in body.lower() or "confirmada" in body.lower():
            print("  JS click succeeded - sale confirmed")
            return True
    except Exception as e:
        print("  JS click error: %s" % e)

    # 3. Ctrl+Enter shortcut
    try:
        page.keyboard.press("Control+Return")
        page.wait_for_timeout(2000)
        try:
            page.wait_for_load_state("networkidle", timeout=10000)
        except:
            pass
        body = page.inner_text("body")
        if "registrada" in body.lower() or "confirmada" in body.lower():
            print("  Ctrl+Enter worked - sale confirmed")
            return True
    except Exception as e:
        print("  Ctrl+Enter error: %s" % e)

    return False


def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()

        # ─── STEP 1: LOGIN ────────────────────────────────────────────────────
        print("\n=== STEP 1: Login ===")
        try:
            page.goto(BASE_URL + "/login", timeout=15000)
            page.wait_for_load_state("networkidle", timeout=15000)
            ss(page, "01_pre_login.png")

            page.fill("#email", EMAIL, timeout=10000)
            page.fill("#password", PASSWORD, timeout=10000)
            ss(page, "01b_credentials_filled.png")

            page.click("button[type='submit']", timeout=10000)
            page.wait_for_load_state("networkidle", timeout=15000)
            page.wait_for_timeout(1500)

            current_url = page.url
            print("  URL after login: %s" % current_url)

            # Complete onboarding via API
            if "onboarding" in current_url:
                print("  Completing onboarding via API...")
                resp = page.request.post(BASE_URL + "/api/auth/complete-onboarding")
                print("  complete-onboarding status: %d" % resp.status)
                nav(page, "/tablero")

            current_url = page.url
            ss(page, "01_login.png")
            logged_in = "login" not in current_url and "onboarding" not in current_url
            log("Login", logged_in, "URL: %s" % current_url)
        except Exception as e:
            ss(page, "01_login_error.png")
            log("Login", False, str(e))
            browser.close()
            return

        # ─── STEP 4: POS — Pintura Latex Interior ────────────────────────────
        # (Done BEFORE step 2 so the tablero shows sale data)
        print("\n=== STEP 4: POS - Pintura Latex Interior ===")
        try:
            nav(page, "/pos")
            ss(page, "04_pos_initial.png")

            # Try to select "Constructoras" price list before adding product
            print("  Selecting Constructoras price list...")
            # The price list selector button shows current list
            # Look for any list selector - it could be "Mostrador (Default)" or similar
            price_list_btn = None
            for sel in [
                "button:has-text('Mostrador (Default)')",
                "button:has-text('Mostrador')",
                "button:has-text('Default')",
            ]:
                try:
                    el = page.locator(sel).first
                    if el.is_visible(timeout=3000):
                        price_list_btn = sel
                        break
                except:
                    pass

            if price_list_btn:
                page.click(price_list_btn, timeout=5000)
                page.wait_for_timeout(500)
                ss(page, "04_pos_lista_dropdown.png")

                # Click Constructoras
                try:
                    page.click("text=Constructoras", timeout=3000)
                    page.wait_for_timeout(500)
                    ss(page, "04_pos_constructoras_selected.png")
                    print("  Constructoras selected")
                except:
                    print(
                        "  Constructoras not in dropdown, looking for other options..."
                    )
                    # Take screenshot to see what's available
                    ss(page, "04_pos_lista_options.png")
                    body = page.inner_text("body")
                    print(
                        "  Available lists: %s"
                        % [
                            w
                            for w in body.split()
                            if "ista" in w.lower()
                            or "constructor" in w.lower()
                            or "plomer" in w.lower()
                        ]
                    )

            # Search for Pintura Latex Interior
            print("  Searching for 'Pintura'...")
            search_input = page.locator("input[type='text']").first
            search_input.clear()
            search_input.fill("Pintura")
            page.wait_for_timeout(2000)
            ss(page, "04b_pos_search_pintura.png")

            # Look for the specific product button
            added = False
            body = page.inner_text("body")
            print(
                "  Search results body snippet: %s"
                % body[
                    body.lower().find("pintura") : body.lower().find("pintura") + 300
                ]
                if "pintura" in body.lower()
                else "  no pintura found"
            )

            for sel in [
                "button:has-text('Pintura L\u00e1tex Interior')",
                "button:has-text('Interior')",
                "button:has-text('Pintura')",
            ]:
                try:
                    btn = page.locator(sel).first
                    if btn.is_visible(timeout=3000):
                        txt = btn.inner_text()[:60]
                        print("  Clicking product button: %r" % txt)
                        btn.click()
                        page.wait_for_timeout(1500)
                        added = True
                        ss(page, "04c_pos_pintura_added.png")
                        break
                except:
                    pass

            if not added:
                print("  WARNING: Could not add Pintura Latex Interior to cart")

            ss(page, "04d_pos_pintura_cart.png")

            # Show cart state
            body = page.inner_text("body")
            print("  POS state: %s" % body[200:600].replace("\n", " | "))

            # Select Transferencia payment method
            print("  Selecting Transferencia...")
            try:
                transferencia_btn = page.locator(
                    "button:has-text('Transferencia')"
                ).first
                if transferencia_btn.is_visible(timeout=5000):
                    transferencia_btn.click()
                    page.wait_for_timeout(500)
                    ss(page, "04e_pos_transferencia.png")
                    print("  Transferencia selected")
                else:
                    print("  Transferencia button not visible")
            except Exception as e:
                print("  Warning Transferencia: %s" % e)

            # Confirm the sale
            print("  Confirming sale...")
            sale_confirmed = complete_pos_sale(page, "Transferencia")
            ss(page, "04f_pos_sale_result.png")

            body = page.inner_text("body")
            print("  Post-sale body: %s" % body[200:600].replace("\n", " | "))

            # Check for success - POS resets to empty state
            success_kws = [
                "venta confirmada",
                "venta registrada",
                "exitosa",
                "0 ventas hoy",
                "ventas hoy",
            ]
            # After a successful sale, POS shows a reset state (no item in cart)
            sale_ok = sale_confirmed or any(
                kw in body.lower() for kw in ["venta", "hoy"]
            )

            log(
                "POS - Pintura Latex Interior (venta con Transferencia)",
                sale_confirmed,
                "Confirmar Venta clickeado"
                if sale_confirmed
                else "No se pudo confirmar la venta",
            )

        except Exception as e:
            ss(page, "04_pos_error.png")
            log("POS - Pintura Latex Interior (venta con Transferencia)", False, str(e))

        # ─── STEP 5: POS — Cable Unipolar ────────────────────────────────────
        print("\n=== STEP 5: POS - Cable Unipolar ===")
        try:
            nav(page, "/pos")
            ss(page, "05_pos_cable_initial.png")

            # Search for Cable Unipolar
            print("  Searching for 'Cable Unipolar'...")
            search_input = page.locator("input[type='text']").first
            search_input.clear()
            search_input.fill("Cable Unipolar")
            page.wait_for_timeout(2000)
            ss(page, "05b_pos_search_cable.png")

            # Click on the product
            added = False
            for sel in [
                "button:has-text('Cable Unipolar')",
                "button:has-text('Cable')",
            ]:
                try:
                    btn = page.locator(sel).first
                    if btn.is_visible(timeout=3000):
                        txt = btn.inner_text()[:60]
                        print("  Clicking: %r" % txt)
                        btn.click()
                        page.wait_for_timeout(1500)
                        added = True
                        ss(page, "05c_pos_cable_added.png")
                        break
                except:
                    pass

            if not added:
                print("  WARNING: Could not add Cable Unipolar")

            # Change quantity to 5
            qty_changed = False
            print("  Changing quantity to 5...")
            for sel in ["input[type='number']"]:
                try:
                    inputs = page.locator(sel).all()
                    for inp in inputs:
                        if inp.is_visible(timeout=2000):
                            current_val = inp.input_value()
                            print("    Current qty value: %r" % current_val)
                            inp.click(click_count=3)
                            inp.fill("5")
                            page.keyboard.press("Tab")
                            page.wait_for_timeout(1000)
                            new_val = inp.input_value()
                            print("    New qty value: %r" % new_val)
                            qty_changed = True
                            ss(page, "05d_pos_cable_qty5.png")
                            break
                    if qty_changed:
                        break
                except Exception as e:
                    print("  qty change error: %s" % e)

            log(
                "POS - Cable Unipolar (cantidad 5 metros)",
                qty_changed,
                "Cantidad cambiada a 5"
                if qty_changed
                else "No se pudo cambiar cantidad",
            )

            # Show cart state
            body = page.inner_text("body")
            print("  Cart: %s" % body[400:700].replace("\n", " | "))
            ss(page, "05e_pos_cable_before_checkout.png")

            # Confirm the sale with Efectivo
            print("  Confirming sale...")
            # Debug: check buttons available before confirming
            all_btns = page.locator("button").all()
            print("  Buttons before confirm:")
            for b in all_btns:
                try:
                    txt = b.inner_text().strip()[:50]
                    vis = b.is_visible()
                    dis = b.is_disabled()
                    if txt:
                        print("    btn: %r vis=%s dis=%s" % (txt, vis, dis))
                except:
                    pass
            sale_confirmed = complete_pos_sale(page, "Efectivo")
            ss(page, "05f_pos_cable_result.png")

            log(
                "POS - Cable Unipolar (venta 5 metros)",
                sale_confirmed,
                "Confirmar Venta clickeado"
                if sale_confirmed
                else "No se pudo confirmar la venta",
            )

        except Exception as e:
            ss(page, "05_pos_cable_error.png")
            log("POS - Cable Unipolar (venta 5 metros)", False, str(e))

        # ─── STEP 2: TABLERO ─────────────────────────────────────────────────
        print("\n=== STEP 2: Tablero ===")
        try:
            nav(page, "/tablero")
            page.wait_for_timeout(2000)  # Extra wait for data to load
            ss(page, "02_tablero.png")

            body = page.inner_text("body")
            current_url = page.url
            loaded = "tablero" in current_url and len(body) > 200
            log("Tablero - carga", loaded, current_url)

            # Check for low stock banner
            body_lower = body.lower()
            has_stock_low = (
                "stock critico" in body_lower
                or "stock bajo" in body_lower
                or "bajo stock" in body_lower
                or "stock critical" in body_lower
                or "taco fisher" in body_lower
                or "producto con stock" in body_lower
            )

            # Print relevant sections
            for keyword in ["stock", "taco", "critico", "bajo", "alerta"]:
                idx = body_lower.find(keyword)
                if idx >= 0:
                    snippet = body[max(0, idx - 40) : idx + 120]
                    print(
                        "  Keyword '%s': ...%s..."
                        % (keyword, snippet.replace("\n", " "))
                    )
                    break

            log(
                "Tablero - banner stock bajo (Taco Fisher)",
                has_stock_low,
                "Banner encontrado"
                if has_stock_low
                else "Banner no visible (puede requerir ventas previas o estar en seccion colapsada)",
            )

            ss(page, "02b_tablero_full.png")
        except Exception as e:
            ss(page, "02_tablero_error.png")
            log("Tablero", False, str(e))

        # ─── STEP 3: PRODUCTOS ────────────────────────────────────────────────
        print("\n=== STEP 3: Productos ===")
        try:
            nav(page, "/productos")
            ss(page, "03_productos.png")

            body = page.inner_text("body")
            body_lower = body.lower()

            # Count rows in table
            row_count = page.locator("table tbody tr").count()
            if row_count == 0:
                row_count = page.locator("tr").count() - 1
            print("  Table rows found: %d" % row_count)

            log(
                "Productos - lista ~16 productos",
                row_count >= 10,
                "Encontrados: %d filas" % row_count,
            )

            has_litro = "litro" in body_lower
            has_metro = "metro" in body_lower
            log(
                "Productos - unidades 'litro'",
                has_litro,
                "Encontrado" if has_litro else "NO encontrado",
            )
            log(
                "Productos - unidades 'metro'",
                has_metro,
                "Encontrado" if has_metro else "NO encontrado",
            )

            ss(page, "03b_productos_full.png")
        except Exception as e:
            ss(page, "03_productos_error.png")
            log("Productos", False, str(e))

        # ─── STEP 6: CLASIFICACIONES ──────────────────────────────────────────
        print("\n=== STEP 6: Clasificaciones ===")
        try:
            nav(page, "/clasificaciones")
            ss(page, "06_clasificaciones.png")

            body = page.inner_text("body")
            body_lower = body.lower()

            has_mostrador = "mostrador" in body_lower
            has_constructoras = "constructoras" in body_lower
            has_plomeros = "plomeros" in body_lower or "gasistas" in body_lower

            log(
                "Clasificaciones - Lista Mostrador",
                has_mostrador,
                "Encontrado" if has_mostrador else "NO encontrado",
            )
            log(
                "Clasificaciones - Lista Constructoras",
                has_constructoras,
                "Encontrado" if has_constructoras else "NO encontrado",
            )
            log(
                "Clasificaciones - Lista Plomeros/Gasistas",
                has_plomeros,
                "Encontrado" if has_plomeros else "NO encontrado",
            )
            log(
                "Clasificaciones - 3 listas de precio",
                has_mostrador and has_constructoras and has_plomeros,
                "Todas presentes"
                if (has_mostrador and has_constructoras and has_plomeros)
                else "Falta alguna lista",
            )

            ss(page, "06b_clasificaciones_full.png")
        except Exception as e:
            ss(page, "06_clasificaciones_error.png")
            log("Clasificaciones", False, str(e))

        # ─── STEP 7: PROVEEDORES ──────────────────────────────────────────────
        print("\n=== STEP 7: Proveedores ===")
        try:
            nav(page, "/proveedores")
            ss(page, "07_proveedores.png")

            row_count = page.locator("table tbody tr").count()
            if row_count == 0:
                row_count = page.locator("tr").count() - 1
            print("  Rows found: %d" % row_count)

            log(
                "Proveedores - 3 proveedores",
                row_count >= 3,
                "Encontrados: %d" % row_count,
            )

            body = page.inner_text("body")
            print(
                "  Proveedores body (200 chars): %s" % body[:200].replace("\n", " | ")
            )

            ss(page, "07b_proveedores_full.png")
        except Exception as e:
            ss(page, "07_proveedores_error.png")
            log("Proveedores", False, str(e))

        browser.close()


def print_summary():
    print("\n" + "=" * 60)
    print("  QA TEST SUMMARY - Ferreteria El Tornillo")
    print("=" * 60)

    passed = [r for r in results if r["passed"]]
    failed = [r for r in results if not r["passed"]]

    print(
        "\nTotal: %d checks | PASS: %d | FAIL: %d\n"
        % (len(results), len(passed), len(failed))
    )

    print("RESULTADOS:")
    for r in results:
        status = "[PASS]" if r["passed"] else "[FAIL]"
        print("  %s %s" % (status, r["step"]))
        if r["detail"]:
            print("      -> %s" % r["detail"])

    if failed:
        print("\nFALLOS DETALLADOS:")
        for r in failed:
            print("  [FAIL] %s" % r["step"])
            if r["detail"]:
                print("         %s" % r["detail"])

    print("\nSCREENSHOTS GUARDADOS (%d):" % len(screenshots_saved))
    for s in screenshots_saved:
        print("  [IMG] %s" % str(SCREENSHOTS_DIR / s))

    print("\n" + "=" * 60)


if __name__ == "__main__":
    print("Starting QA tests for Ferreteria El Tornillo...")
    print("Screenshots dir: %s" % SCREENSHOTS_DIR)
    run_tests()
    print_summary()
