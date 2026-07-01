const DEFAULT_WHATSAPP_COUNTRY_CODE = "54";

function getWhatsappCountryCode() {
  return (
    process.env.NEXT_PUBLIC_WHATSAPP_COUNTRY_CODE?.replace(/\D/g, "") ||
    DEFAULT_WHATSAPP_COUNTRY_CODE
  );
}

function normalizeWhatsappPhone(phone: string) {
  const countryCode = getWhatsappCountryCode();
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith(`00${countryCode}`)) {
    return digits.slice(2);
  }

  if (digits.startsWith(countryCode)) {
    return digits;
  }

  return `${countryCode}${digits.replace(/^0+/, "")}`;
}

export function buildWhatsappUrl(input: { phone: string; message: string }) {
  const normalizedPhone = normalizeWhatsappPhone(input.phone);

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(input.message)}`;
}
