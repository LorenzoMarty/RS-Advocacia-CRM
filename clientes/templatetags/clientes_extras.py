from django import template

register = template.Library()


@register.filter
def format_document(value):
    digits = "".join(char for char in str(value or "") if char.isdigit())

    if len(digits) == 11:
        return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"

    if len(digits) == 14:
        return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}"

    return value


@register.filter
def document_label(value):
    digits = "".join(char for char in str(value or "") if char.isdigit())
    return "CNPJ" if len(digits) == 14 else "CPF"
