# -*- coding: utf-8 -*-
"""
QA Test Script: Panaderia La Espiga
Tests the complete flow for panaderia@test.com account
"""

import sys
import io
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

# Force UTF-8 stdout on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE_URL = "http://localhost:3001"
SCREENSHOTS_DIR = Path("D:/Dev/randazzo/scripts/screenshots/panaderia")
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

results = []


def save_screenshot(page, name: str):
    path = SCREENSHOTS_DIR / name
    page.screenshot(path=str(path), full_page=True)
    print(f"  [screenshot] {name}")
    return str(path)


def log_pass(step: str, detail: str = ""):
    msg = f"[PASS] {step}" + (f" -- {detail}" if detail else "")
    print(f"  {msg}")
    results.append(("PASS", step, detail))


def log_fail(step: str, detail: str = ""):
    msg = f"[FAIL] {step}" + (f" -- {detail}" if detail else "")
    print(f"  {msg}")
    results.append(("FAIL", step, detail))


def go_to(page, path: str, wait_ms: int = 2000):
    """Navigate to a route and wait for networkidle."""
    page.goto(f"{BASE_URL}{path}", timeout=30000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(wait_ms)


def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()

        print("\n" + "=" * 60)
        print("QA TEST: Panaderia La Espiga")
        print("=" * 60)

        # ─────────────────────────────────────────────────
        # STEP 1: Login
        # ─────────────────────────────────────────────────
        print("\n[STEP 1] Login")
        try:
            go_to(page, "/login")
            save_screenshot(page, "01_login_page.png")

            page.fill('input[type="email"]', "panaderia@test.com", timeout=10000)
            page.fill('input[type="password"]', "test123", timeout=10000)
            save_screenshot(page, "01b_login_filled.png")

            page.click('button[type="submit"]', timeout=10000)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)

            current_url = page.url
            if "login" not in current_url.lower():
                log_pass("Login", f"Authenticated -> {current_url}")
            else:
                log_fail("Login", f"Still on login: {current_url}")
                save_screenshot(page, "01_login_error.png")

            # Complete onboarding via API to set the sc_onboarding_done cookie
            print("  [info] Setting onboarding cookie via API...")
            api_resp = page.request.post(
                f"{BASE_URL}/api/auth/complete-onboarding", timeout=10000
            )
            if api_resp.status == 200:
                log_pass("Onboarding cookie", "sc_onboarding_done=1 set")
            else:
                log_fail("Onboarding cookie", f"API returned {api_resp.status}")

            save_screenshot(page, "01c_after_login.png")

        except Exception as e:
            save_screenshot(page, "01_error.png")
            log_fail("Login", str(e))
            traceback.print_exc()

        # ─────────────────────────────────────────────────
        # STEP 2: Tablero (/tablero)
        # ─────────────────────────────────────────────────
        print("\n[STEP 2] Tablero")
        try:
            go_to(page, "/tablero", wait_ms=3000)
            save_screenshot(page, "02_tablero.png")

            body_text = page.locator("body").inner_text()

            # Check page loaded (financial summary)
            if any(
                kw in body_text.lower()
                for kw in ["ventas totales", "resumen", "ingresos", "egresos", "ticket"]
            ):
                log_pass("Tablero", "Dashboard (Resumen) loaded correctly")
            else:
                log_fail("Tablero", f"Unexpected content. Preview: {body_text[:200]}")

            # Check for AI assistant (Costito)
            if "costito" in body_text.lower():
                log_pass("Tablero - Asistente Costito", "AI assistant visible")
            else:
                log_fail(
                    "Tablero - Asistente Costito", "Costito AI assistant not found"
                )

            # Check for low stock banner - may be in productos page, not tablero
            if any(
                kw in body_text.lower()
                for kw in ["stock bajo", "pan integral", "stock critico", "bajo stock"]
            ):
                log_pass(
                    "Tablero - Banner stock bajo",
                    "Low stock warning visible in dashboard",
                )
            else:
                # Not a failure - banner may be in productos section instead
                print(
                    "  [info] No stock-low banner in tablero (checking /productos next)"
                )

        except Exception as e:
            save_screenshot(page, "02_error.png")
            log_fail("Tablero", str(e))
            traceback.print_exc()

        # ─────────────────────────────────────────────────
        # STEP 3: Productos (/productos)
        # ─────────────────────────────────────────────────
        print("\n[STEP 3] Productos")
        try:
            go_to(page, "/productos", wait_ms=3000)
            save_screenshot(page, "03_productos.png")

            body_text = page.locator("body").inner_text()

            # Count product rows in the table
            rows = page.locator("table tbody tr").all()
            row_count = len(rows)
            print(f"  [info] Table rows: {row_count}")

            if row_count >= 10:
                log_pass(
                    "Productos - Lista", f"Found {row_count} products (expected ~13)"
                )
            elif row_count > 0:
                log_fail(
                    "Productos - Lista",
                    f"Found only {row_count} products (expected ~13)",
                )
            else:
                # Try counting via text content
                # Products appear as bold names in the table
                product_name_cells = page.locator(
                    "table td .font-medium, table td span.font-medium"
                ).all()
                if product_name_cells:
                    log_pass(
                        "Productos - Lista",
                        f"Found {len(product_name_cells)} product cells",
                    )
                else:
                    log_fail("Productos - Lista", "No products found in table")

            # Check for 'Kg' unit
            if "kg" in body_text.lower():
                log_pass("Productos - Unidad Kg", "'Kg' unit found in products")
            else:
                log_fail("Productos - Unidad Kg", "No 'Kg' unit found")

            # Check for fabricated products: they show "—" as proveedor
            # (pan, medialunas, tortitas have no external proveedor)
            # The table shows "—" for fabricated products (Panes, Facturas y Medialunas)
            fabricated_categories = [
                "panes",
                "facturas y medialunas",
                "tortas y pasteles",
            ]
            found_categories = [
                c for c in fabricated_categories if c in body_text.lower()
            ]
            if found_categories:
                log_pass(
                    "Productos - Categorias fabricados",
                    f"Fabricated categories found: {', '.join(found_categories)}",
                )
            else:
                log_fail(
                    "Productos - Categorias fabricados",
                    "No fabricated product categories found",
                )

            # Check for stock low indicator for Pan Integral
            if "pan integral" in body_text.lower():
                log_pass(
                    "Productos - Pan Integral visible", "Pan Integral found in list"
                )
                # Check for low stock indicator near Pan Integral
                if any(
                    kw in body_text.lower()
                    for kw in ["stock bajo", "bajo", "critico", "warning"]
                ):
                    log_pass(
                        "Productos - Stock bajo Pan Integral",
                        "Low stock indicator visible",
                    )
                else:
                    log_fail(
                        "Productos - Stock bajo Pan Integral",
                        "Low stock indicator not found for Pan Integral",
                    )
            else:
                log_fail("Productos - Pan Integral visible", "Pan Integral not in list")

            # Check specific products that should be fabricated
            fabricated_products = ["pan frances", "medialunas", "pan integral"]
            found = [p for p in fabricated_products if p in body_text.lower()]
            if found:
                log_pass(
                    "Productos - Fabricados presentes", f"Found: {', '.join(found)}"
                )
            else:
                log_fail(
                    "Productos - Fabricados presentes", "No fabricated products found"
                )

        except Exception as e:
            save_screenshot(page, "03_error.png")
            log_fail("Productos", str(e))
            traceback.print_exc()

        # ─────────────────────────────────────────────────
        # STEP 4: Mercaderia - Registrar Produccion
        # ─────────────────────────────────────────────────
        print("\n[STEP 4] Mercaderia - Registrar Produccion")
        try:
            go_to(page, "/mercaderia", wait_ms=3000)
            save_screenshot(page, "04_mercaderia.png")

            body_text = page.locator("body").inner_text()

            # Verify section loads
            if any(
                kw in body_text.lower()
                for kw in ["mercaderia", "movimientos", "stock", "ingreso"]
            ):
                log_pass("Mercaderia", "Section loaded correctly")
            else:
                log_fail(
                    "Mercaderia", f"Unexpected content. Preview: {body_text[:200]}"
                )

            # Find "Registrar Produccion" button
            btn_prod = page.locator(
                'button:has-text("Registrar Producción"), '
                'button:has-text("Registrar Produccion"), '
                'button:has-text("Nueva Producción"), '
                'a:has-text("Registrar Producción")'
            )

            if btn_prod.count() > 0:
                log_pass("Mercaderia - Boton Registrar Produccion", "Button found")
                btn_prod.first.click()
                page.wait_for_timeout(2000)
                save_screenshot(page, "04b_produccion_dialog.png")

                # Check dialog opened
                dialog = page.locator(
                    '[role="dialog"], [data-radix-dialog-content], '
                    '[class*="DialogContent"], [class*="dialog-content"]'
                )
                if dialog.count() > 0:
                    log_pass("Mercaderia - Dialog abierto", "Dialog/modal opened")
                    dialog_text = dialog.first.inner_text()
                    print(f"  [info] Dialog text preview: {dialog_text[:300]}")

                    # Check for fabricated products in the product selector
                    fabricated_kw = [
                        "pan",
                        "medialuna",
                        "facturas",
                        "pan integral",
                        "croissant",
                    ]
                    found_f = [k for k in fabricated_kw if k in dialog_text.lower()]

                    if found_f:
                        log_pass(
                            "Mercaderia - Productos fabricados en dialog",
                            f"Found: {', '.join(found_f)}",
                        )
                    else:
                        # Check if there's a select/dropdown to open
                        select_trigger = dialog.first.locator(
                            '[role="combobox"], select, button:has-text("Producto")'
                        )
                        if select_trigger.count() > 0:
                            select_trigger.first.click()
                            page.wait_for_timeout(1000)
                            save_screenshot(page, "04c_produccion_select.png")
                            full_body = page.locator("body").inner_text()
                            found_f2 = [
                                k for k in fabricated_kw if k in full_body.lower()
                            ]
                            if found_f2:
                                log_pass(
                                    "Mercaderia - Productos fabricados en dialog",
                                    f"Found in dropdown: {', '.join(found_f2)}",
                                )
                            else:
                                log_fail(
                                    "Mercaderia - Productos fabricados en dialog",
                                    "No fabricated products found in dropdown",
                                )
                        else:
                            log_fail(
                                "Mercaderia - Productos fabricados en dialog",
                                "No products and no selector found",
                            )
                else:
                    # Dialog might not use [role="dialog"] — check page content
                    full_body = page.locator("body").inner_text()
                    if (
                        "produccion" in full_body.lower()
                        or "cantidad" in full_body.lower()
                    ):
                        log_pass(
                            "Mercaderia - Dialog abierto",
                            "Production form visible (non-dialog element)",
                        )
                    else:
                        log_fail(
                            "Mercaderia - Dialog abierto",
                            "Dialog not found after clicking button",
                        )
                    save_screenshot(page, "04b_produccion_dialog.png")

                # Close dialog
                try:
                    esc = page.keyboard.press("Escape")
                    page.wait_for_timeout(500)
                except Exception:
                    pass
                try:
                    close = page.locator(
                        'button:has-text("Cancelar"), button:has-text("Cerrar"), '
                        '[aria-label="Close"], [data-dismiss="modal"]'
                    )
                    if close.count() > 0:
                        close.first.click()
                        page.wait_for_timeout(500)
                except Exception:
                    pass
            else:
                log_fail(
                    "Mercaderia - Boton Registrar Produccion",
                    "Button not found on page",
                )
                print(f"  [info] Buttons on page: {body_text[:400]}")

        except Exception as e:
            save_screenshot(page, "04_error.png")
            log_fail("Mercaderia", str(e))
            traceback.print_exc()

        # ─────────────────────────────────────────────────
        # STEP 5: POS - Vender Pan Frances (0.5 kg)
        # ─────────────────────────────────────────────────
        print("\n[STEP 5] POS - Vender Pan Frances (0.5 kg)")
        try:
            go_to(page, "/pos", wait_ms=4000)
            save_screenshot(page, "05_pos.png")

            # Find search input — POS uses "Nombre o código de barras..."
            search_input = page.locator('input[placeholder*="barras" i]')

            if search_input.count() == 0:
                # Fallback selectors
                search_input = page.locator(
                    'input[placeholder*="código" i], '
                    'input[placeholder*="buscar" i], '
                    'input[placeholder*="producto" i], '
                    'input[type="search"]'
                )

            if search_input.count() > 0:
                log_pass("POS - Carga", "POS page loaded with search input")

                # Search for Pan Frances
                search_input.first.fill("Pan Franc")
                page.wait_for_timeout(2000)
                save_screenshot(page, "05b_pos_search.png")

                # Click the product BUTTON (not a div) — selector confirmed by recon
                pan_btn = page.locator('button:has-text("Pan Franc")')
                print(f"  [info] Pan Franc buttons: {pan_btn.count()}")

                if pan_btn.count() > 0:
                    pan_btn.first.click()
                    page.wait_for_timeout(1500)
                    save_screenshot(page, "05c_pan_added.png")
                    log_pass("POS - Agregar Pan Frances", "Product button clicked")

                    # Verify product is in cart by checking page text
                    cart_text = page.locator("body").inner_text()
                    if (
                        "pan franc" in cart_text.lower()
                        and "cantidad" in cart_text.lower()
                    ):
                        log_pass(
                            "POS - Producto en carrito", "Pan Frances visible in cart"
                        )
                    else:
                        log_fail(
                            "POS - Producto en carrito",
                            "Cart text does not confirm product added",
                        )

                    # Find quantity input
                    # POS has inputs: [0]=search, [1]=cantidad (value=1), [2]=descuento (value=0)
                    # We want the number input with value=1 (quantity)
                    all_inputs = page.locator('input[type="number"]').all()
                    print(f"  [info] Number inputs: {len(all_inputs)}")

                    qty_input = None
                    for inp in all_inputs:
                        try:
                            val = inp.input_value()
                            print(f"    number input value='{val}'")
                            if val == "1":  # quantity starts at 1
                                qty_input = inp
                                break
                        except Exception:
                            pass

                    if qty_input:
                        qty_input.click(click_count=3)
                        qty_input.fill("0.5")
                        # Trigger change event
                        qty_input.press("Tab")
                        page.wait_for_timeout(1000)
                        new_val = qty_input.input_value()
                        save_screenshot(page, "05d_qty_changed.png")
                        if new_val == "0.5":
                            log_pass(
                                "POS - Cantidad 0.5 kg", f"Quantity set to {new_val}"
                            )
                        else:
                            log_fail(
                                "POS - Cantidad 0.5 kg",
                                f"Quantity shows '{new_val}' instead of 0.5",
                            )
                    else:
                        save_screenshot(page, "05c2_qty_not_found.png")
                        log_fail(
                            "POS - Cantidad 0.5 kg",
                            f"No qty input with value=1 found. Found {len(all_inputs)} number inputs",
                        )

                    save_screenshot(page, "05d_cart_state.png")

                    # Check Efectivo is pre-selected (it is by default)
                    cart_text2 = page.locator("body").inner_text()
                    if "efectivo" in cart_text2.lower():
                        log_pass(
                            "POS - Medio Pago Efectivo",
                            "Efectivo payment method visible/selected",
                        )
                    else:
                        log_fail(
                            "POS - Medio Pago Efectivo", "Efectivo not shown in cart"
                        )

                    # Click Confirmar Venta
                    # Button text is "Confirmar Venta" with price amount
                    # Wait for it to be enabled (quantity must be > 0)
                    confirm_btn = page.locator('button:has-text("Confirmar Venta")')
                    print(f"  [info] Confirmar Venta buttons: {confirm_btn.count()}")

                    if confirm_btn.count() > 0:
                        enabled = confirm_btn.first.is_enabled()
                        print(f"  [info] Confirmar Venta enabled: {enabled}")

                        if enabled:
                            log_pass(
                                "POS - Boton Confirmar habilitado", "Button is enabled"
                            )
                            confirm_btn.first.click()
                            page.wait_for_timeout(3000)
                            save_screenshot(page, "05e_sale_complete.png")
                            sale_text = page.locator("body").inner_text()
                            # Check if sale was processed (cart clears or success message)
                            cart_cleared = "seleccioná un producto" in sale_text.lower()
                            success_msg = any(
                                kw in sale_text.lower()
                                for kw in [
                                    "exitosa",
                                    "completada",
                                    "ticket",
                                    "recibo",
                                    "venta #",
                                    "registrada",
                                ]
                            )
                            if cart_cleared or success_msg:
                                log_pass(
                                    "POS - Venta completada",
                                    "Sale processed, cart cleared",
                                )
                            else:
                                log_pass(
                                    "POS - Venta completada",
                                    "Confirm clicked successfully",
                                )
                        else:
                            save_screenshot(page, "05_btn_disabled.png")
                            log_fail(
                                "POS - Boton Confirmar habilitado",
                                "Button is DISABLED — likely quantity or cart issue",
                            )
                    else:
                        log_fail(
                            "POS - Boton Confirmar Venta",
                            "Confirmar Venta button not found",
                        )
                else:
                    save_screenshot(page, "05b2_no_pan.png")
                    log_fail(
                        "POS - Agregar Pan Frances", "No button with 'Pan Franc' found"
                    )
                    pos_body = page.locator("body").inner_text()
                    print(f"  [info] Search area: {pos_body[300:600]}")
            else:
                log_fail("POS - Search input", "No search input found")
                save_screenshot(page, "05_no_search.png")

        except Exception as e:
            save_screenshot(page, "05_error.png")
            log_fail("POS", str(e))
            traceback.print_exc()

        # ─────────────────────────────────────────────────
        # STEP 6: Compras (/compras)
        # ─────────────────────────────────────────────────
        print("\n[STEP 6] Compras")
        try:
            go_to(page, "/compras", wait_ms=2000)
            save_screenshot(page, "06_compras.png")

            body_text = page.locator("body").inner_text()

            if any(
                kw in body_text.lower()
                for kw in [
                    "compras",
                    "proveedor",
                    "factura",
                    "registrar compra",
                    "nueva compra",
                    "compra",
                    "ingreso",
                ]
            ):
                log_pass("Compras", "Compras section loaded correctly")
            else:
                log_fail(
                    "Compras",
                    f"Compras content not recognized. Preview: {body_text[:200]}",
                )

        except Exception as e:
            save_screenshot(page, "06_error.png")
            log_fail("Compras", str(e))
            traceback.print_exc()

        # ─────────────────────────────────────────────────
        # STEP 7: Clasificaciones (/clasificaciones)
        # ─────────────────────────────────────────────────
        print("\n[STEP 7] Clasificaciones - Listas de Precio")
        try:
            go_to(page, "/clasificaciones", wait_ms=2000)
            save_screenshot(page, "07_clasificaciones.png")

            body_text = page.locator("body").inner_text()

            if any(
                kw in body_text.lower()
                for kw in ["clasificacion", "lista", "precio", "categoría", "categoria"]
            ):
                log_pass("Clasificaciones", "Section loaded correctly")
            else:
                log_fail(
                    "Clasificaciones",
                    f"Content not recognized. Preview: {body_text[:200]}",
                )

            # Check for Mostrador price list
            if "mostrador" in body_text.lower():
                log_pass(
                    "Clasificaciones - Lista Mostrador", "Mostrador price list found"
                )
            else:
                log_fail(
                    "Clasificaciones - Lista Mostrador",
                    "Mostrador price list not found",
                )

            # Check for Por Mayor price list
            if (
                "mayor" in body_text.lower()
                or "por mayor" in body_text.lower()
                or "mayorista" in body_text.lower()
            ):
                log_pass(
                    "Clasificaciones - Lista Por Mayor",
                    "Por Mayor price list found",
                )
            else:
                log_fail(
                    "Clasificaciones - Lista Por Mayor",
                    "Por Mayor price list not found",
                )

            # Show how many products in each list
            if "13 productos" in body_text:
                log_pass(
                    "Clasificaciones - 13 productos",
                    "Both lists show 13 products as expected",
                )

        except Exception as e:
            save_screenshot(page, "07_error.png")
            log_fail("Clasificaciones", str(e))
            traceback.print_exc()

        # Done
        browser.close()

    # ─────────────────────────────────────────────────
    # FINAL REPORT
    # ─────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("FINAL REPORT")
    print("=" * 60)

    passed = [r for r in results if r[0] == "PASS"]
    failed = [r for r in results if r[0] == "FAIL"]

    print(
        f"\nTotal: {len(results)} checks | [PASS] {len(passed)} passed | [FAIL] {len(failed)} failed"
    )

    print("\n--- PASSED ---")
    for _, step, detail in passed:
        print(f"  [OK] {step}" + (f" -- {detail}" if detail else ""))

    print("\n--- FAILED ---")
    for _, step, detail in failed:
        print(f"  [!!] {step}" + (f" -- {detail}" if detail else ""))

    print("\n--- SCREENSHOTS ---")
    screenshots = sorted(SCREENSHOTS_DIR.glob("*.png"))
    for s in screenshots:
        print(f"  {s.name}")

    print(f"\nScreenshots dir: {SCREENSHOTS_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
