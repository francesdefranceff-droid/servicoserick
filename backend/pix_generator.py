"""
PIX BR Code (EMV) generator for static PIX QR codes.
No external API needed - generates compliant BR Code that any Brazilian bank app can pay.
Spec: https://www.bcb.gov.br/content/estabilidadefinanceira/SiteAssets/Manual%20do%20BR%20Code.pdf
"""
import qrcode
import base64
from io import BytesIO


def _crc16_ccitt(payload: str) -> str:
    """CRC16-CCITT (polynomial 0x1021, initial 0xFFFF) for PIX BR Code."""
    polynomial = 0x1021
    crc = 0xFFFF
    for byte in payload.encode('utf-8'):
        crc ^= byte << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ polynomial
            else:
                crc = crc << 1
            crc &= 0xFFFF
    return f"{crc:04X}"


def _field(id_: str, value: str) -> str:
    """Encode a TLV field: 2-digit id + 2-digit length + value."""
    return f"{id_}{len(value):02d}{value}"


def build_pix_brcode(
    pix_key: str,
    merchant_name: str,
    merchant_city: str,
    amount: float,
    txid: str = "***",
    description: str = "",
) -> str:
    """
    Build a static PIX BR Code (copia e cola).
    Args:
        pix_key: Chave PIX (email, CPF, CNPJ, telefone ou chave aleatória)
        merchant_name: Nome do recebedor (até 25 chars)
        merchant_city: Cidade (até 15 chars)
        amount: Valor em reais (ex.: 35.90)
        txid: ID da transação (até 25 chars, use *** para genérico)
        description: Descrição opcional
    Returns: BR Code string (cola no app bancário)
    """
    # Sanitize
    merchant_name = (merchant_name or "JATAI REGIAO")[:25].upper()
    merchant_city = (merchant_city or "SAO PAULO")[:15].upper()
    txid = (txid or "***")[:25]

    # Merchant Account Information (ID 26)
    # 00 - GUI fixo "br.gov.bcb.pix"
    # 01 - chave PIX
    # 02 - descrição (opcional)
    mai_value = _field("00", "br.gov.bcb.pix") + _field("01", pix_key)
    if description:
        mai_value += _field("02", description[:50])
    mai = _field("26", mai_value)

    # Additional data field (ID 62) — txid
    add_data = _field("62", _field("05", txid))

    payload = (
        _field("00", "01")               # Payload format indicator
        + _field("01", "11")             # POI Method (11 = estático)
        + mai                            # Merchant Account Info
        + _field("52", "0000")           # Merchant Category Code
        + _field("53", "986")            # Currency BRL
        + _field("54", f"{amount:.2f}")  # Amount
        + _field("58", "BR")             # Country
        + _field("59", merchant_name)    # Merchant name
        + _field("60", merchant_city)    # Merchant city
        + add_data                       # Additional data (txid)
        + "6304"                         # CRC16 placeholder header
    )

    crc = _crc16_ccitt(payload)
    return payload + crc


def generate_pix_qr_base64(brcode: str) -> str:
    """Generate a PNG QR code (base64 data URL) from the BR Code."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(brcode)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    encoded = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{encoded}"
