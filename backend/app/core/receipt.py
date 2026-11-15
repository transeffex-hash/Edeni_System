from datetime import timezone
from html import escape
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from backend.app.core.pii_crypto import pii_decrypt
from backend.app.models.entities import Branch, Business, Product, Sale, SaleItem, User

KIGALI = ZoneInfo("Africa/Kigali")


def _local(dt):
    if dt is None:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(KIGALI).strftime("%Y-%m-%d %H:%M")


def render_receipt_html(db: Session, sale: Sale, business: Business, *, public: bool = False) -> str:
    items = db.query(SaleItem).filter(SaleItem.sale_id == sale.id).order_by(SaleItem.id.asc()).all()

    product_ids = {si.product_id for si in items}
    products = db.query(Product.id, Product.name).filter(Product.id.in_(product_ids)).all() if product_ids else []
    product_names = {p.id: p.name for p in products}

    customer_name = pii_decrypt(sale.customer_name_enc) if sale.customer_name_enc else None
    business_phone = pii_decrypt(business.phone_enc) if business.phone_enc else None

    cashier = db.query(User).filter(User.id == sale.created_by_user_id).first()
    cashier_email = pii_decrypt(cashier.email_enc) if cashier else f"User #{sale.created_by_user_id}"

    branch_name = None
    if sale.branch_id:
        branch = db.query(Branch).filter(Branch.id == sale.branch_id).first()
        branch_name = branch.name if branch else None

    logo_html = f'<img src="{escape(business.logo_url)}" alt="logo" class="logo" />' if business.logo_url else ""

    items_html = ""
    for si in items:
        product_name = product_names.get(si.product_id, f"Product #{si.product_id}")
        qty_display = si.display_quantity if si.display_quantity else si.quantity
        qty_str = str(int(qty_display)) if float(qty_display).is_integer() else f"{float(qty_display):g}"
        unit_display = si.display_unit if si.display_unit else "unit"
        items_html += (
            f"<tr><td class='product'>{escape(product_name)}</td>"
            f"<td class='r'>{qty_str} {escape(unit_display)}</td>"
            f"<td class='r'>{float(si.unit_price):,.0f}</td>"
            f"<td class='r'>{float(si.line_total):,.0f}</td></tr>"
        )

    status = getattr(sale, "status", "paid") or "paid"
    banner = ""
    if sale.is_voided:
        banner = '<div class="voided">VOIDED</div>'
    elif status == "draft":
        banner = '<div class="unpaid">NOT PAID — PROVISIONAL BILL</div>'

    due_line = f"Due: {sale.due_date}<br>" if sale.is_credit and sale.due_date else ""
    pay_label = sale.payment_method.value.upper() + (" (CREDIT)" if sale.is_credit else "")
    info_lines = f"Receipt: #{sale.id}<br>Date: {_local(sale.created_at)}<br>"
    if status != "draft":
        info_lines += f"Payment: {pay_label}<br>{due_line}"
    if customer_name:
        info_lines += f"Customer: {escape(customer_name)}<br>"
    if not public:
        info_lines += f"Cashier: {escape(cashier_email)}<br>"
    if branch_name:
        info_lines += f"Branch: {escape(branch_name)}<br>"

    payments_html = ""
    payments = getattr(sale, "payments", None)
    if payments:
        rows = "".join(
            f"<tr><td>{_local(p.created_at)}</td><td>{escape(p.method.value.upper() if hasattr(p.method, 'value') else str(p.method).upper())}</td><td class='r'>{float(p.amount):,.0f}</td></tr>"
            for p in payments
        )
        paid_total = sum(float(p.amount) for p in payments)
        balance = float(sale.total_amount) - paid_total
        payments_html = (
            "<div class='divider'></div><div class='info'><b>Payments</b></div>"
            f"<table><tbody>{rows}</tbody></table>"
            f"<div class='info r'>Paid: RWF {paid_total:,.0f}"
            + (f"<br><span class='balance'>Balance due: RWF {balance:,.0f}</span>" if balance > 0.5 else "")
            + "</div>"
        )

    momo_line = f'<div class="business-phone">MoMo Code: {escape(business.momo_code)}</div>' if business.momo_code else ""
    tin_line = f'<div class="business-phone">TIN: {escape(business.tin)}</div>' if business.tin else ""
    tel_line = f'<div class="business-phone">Tel: {escape(business_phone)}</div>' if business_phone else ""

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Receipt #{sale.id} - {escape(business.name)}</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box;font-family:'Arial','Helvetica',sans-serif}}
body{{max-width:360px;margin:0 auto;padding:20px;color:#000;background:#fff;font-size:13px;font-weight:700;line-height:1.4}}
.logo{{max-height:64px;max-width:180px;object-fit:contain;display:block;margin:0 auto 12px}}
.header{{text-align:center;margin-bottom:14px}}
.business-name{{font-size:20px;font-weight:900;letter-spacing:.5px}}
.business-phone{{font-size:13px;font-weight:800;color:#333;margin-top:4px}}
.divider{{border-top:2px dashed #000;margin:10px 0}}
.voided{{color:#dc2626;font-weight:900;text-align:center;font-size:18px;border:3px solid #dc2626;padding:6px;margin:10px 0;border-radius:4px}}
.unpaid{{color:#b45309;font-weight:900;text-align:center;font-size:14px;border:3px solid #b45309;padding:6px;margin:10px 0;border-radius:4px}}
.balance{{color:#dc2626}}
.info{{font-size:13px;font-weight:700;line-height:1.6;margin-bottom:10px}}
table{{width:100%;border-collapse:collapse;margin:10px 0}}
th{{border-bottom:3px solid #000;padding:6px 3px;font-size:12px;font-weight:900;text-align:left;text-transform:uppercase;letter-spacing:.4px}}
td{{padding:7px 3px;font-size:13px;font-weight:700;border-bottom:1px dashed #999;vertical-align:top}}
.product{{font-weight:900}}
.r{{text-align:right}}
.total{{border-top:3px solid #000;margin-top:12px;padding-top:12px;text-align:right;font-size:20px;font-weight:900}}
.footer{{text-align:center;margin-top:18px;font-size:12px;font-weight:700;color:#333;line-height:1.6}}
.print-btn{{display:block;width:100%;margin:0 0 16px;padding:12px;font-size:15px;cursor:pointer;background:#0a7e6b;color:#fff;border:none;border-radius:6px;font-weight:900}}
.print-btn:hover{{background:#096657}}
@media print{{.print-btn{{display:none}}body{{max-width:100%;padding:0;font-size:12px}}th,td{{font-weight:700}}}}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">Print Receipt</button>
<div class="header">
{logo_html}
<div class="business-name">{escape(business.name)}</div>
{tel_line}
{tin_line}
{momo_line}
</div>
{banner}
<div class="divider"></div>
<div class="info">{info_lines}</div>
<table>
<thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Total</th></tr></thead>
<tbody>{items_html}</tbody>
</table>
<div class="total">Total: RWF {float(sale.total_amount):,.0f}</div>
{payments_html}
<div class="divider"></div>
<div class="footer">Thank you for your business!<br>Powered by EdeniSystem</div>
</body>
</html>"""
