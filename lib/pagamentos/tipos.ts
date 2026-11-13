export type PixCriado = {
  provedor: string;
  idPagamento: string;
  copiaECola: string;
  link: string | null;
  expiraEm: string;
};

export type SituacaoPagamento =
  | { pago: true; valorCentavos: number; pagoEm: string; referencia: string | null }
  | { pago: false; encerrado: boolean; detalhe: string };

export class ErroPagamento extends Error {}
