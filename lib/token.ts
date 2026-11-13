/** Tokens de convite e de pagamento: 32 caracteres hexadecimais. */
export const tokenValido = (t: string) => /^[a-f0-9]{32}$/.test(t);
