from io import BytesIO
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.business import Business
from app.models.product import Product
from app.models.sale import Sale


def build_invoice_pdf(business: Business, sale: Sale, products: dict) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
    )
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph(business.name, styles["Title"]))
    if business.address:
        story.append(Paragraph(business.address.replace("\n", "<br/>"), styles["Normal"]))
    if business.phone:
        story.append(Paragraph(f"Phone: {business.phone}", styles["Normal"]))
    if business.tax_enabled and business.tax_number:
        story.append(Paragraph(f"Tax No: {business.tax_number}", styles["Normal"]))
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(f"Invoice {sale.invoice_number}", styles["Heading2"]))
    story.append(Paragraph(f"Date: {sale.created_at.strftime('%d %b %Y, %I:%M %p')}", styles["Normal"]))
    story.append(Paragraph(f"Payment: {sale.payment_method} ({sale.payment_status})", styles["Normal"]))
    story.append(Spacer(1, 6 * mm))

    data = [["Item", "Qty", "Price", "Tax", "Total"]]
    for item in sale.items:
        product: Product | None = products.get(item.product_id)
        name = product.name if product else str(item.product_id)
        data.append(
            [
                name,
                str(item.quantity),
                f"{business.currency} {item.unit_price}",
                f"{business.currency} {item.tax}",
                f"{business.currency} {item.total}",
            ]
        )
    data.append(["", "", "", "Subtotal", f"{business.currency} {sale.subtotal}"])
    data.append(["", "", "", "Discount", f"{business.currency} {sale.discount}"])
    data.append(["", "", "", "Tax", f"{business.currency} {sale.tax}"])
    data.append(["", "", "", "Total", f"{business.currency} {sale.total}"])

    table = Table(data, colWidths=[80 * mm, 25 * mm, 30 * mm, 25 * mm, 30 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -5), 0.25, colors.lightgrey),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 10 * mm))
    thanks = business.invoice_thank_you or "Thank you for your business."
    story.append(Paragraph(thanks, styles["Italic"]))
    doc.build(story)
    return buffer.getvalue()


def money(value: Decimal) -> str:
    return f"{value:.2f}"
