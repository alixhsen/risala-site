// Builds a WhatsApp click-to-chat link from a stored phone number.
export const waLink = (number) => `https://wa.me/${String(number).replace(/[^\d]/g, '')}`;
