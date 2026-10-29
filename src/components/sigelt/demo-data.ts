// Todos estos datos son sintéticos. No representan una empresa participante.
export const products = [
  { id: 'CUA-001', name: 'Cuaderno cuadriculado', detail: '100 hojas · tamaño carta', category: 'Cuadernos', stock: 42, minimum: 10, price: 8500, icon: 'book' },
  { id: 'LAP-002', name: 'Lápiz de grafito HB', detail: 'Unidad · escritura', category: 'Escritura', stock: 38, minimum: 10, price: 1500, icon: 'pencil' },
  { id: 'MAR-003', name: 'Marcador permanente', detail: 'Punta fina · negro', category: 'Escritura', stock: 8, minimum: 10, price: 3500, icon: 'pencil' },
  { id: 'PAP-004', name: 'Resma de papel carta', detail: '500 hojas · blanco', category: 'Papel', stock: 24, minimum: 10, price: 18000, icon: 'paper' },
  { id: 'BOR-005', name: 'Borrador de nata', detail: 'Unidad · blanco', category: 'Accesorios', stock: 12, minimum: 10, price: 1000, icon: 'box' },
] as const;

export const months = ['Agosto de 2026', 'Septiembre de 2026'] as const;
export const sales = [
  { id: 'V-001', month: 0, date: '06 ago', time: '09:24', items: [{ product: 0, quantity: 3 }, { product: 1, quantity: 5 }] },
  { id: 'V-002', month: 0, date: '14 ago', time: '14:10', items: [{ product: 3, quantity: 2 }, { product: 2, quantity: 2 }] },
  { id: 'V-003', month: 0, date: '25 ago', time: '11:42', items: [{ product: 0, quantity: 2 }, { product: 4, quantity: 3 }] },
  { id: 'V-004', month: 1, date: '05 sep', time: '10:18', items: [{ product: 0, quantity: 4 }, { product: 1, quantity: 8 }] },
  { id: 'V-005', month: 1, date: '16 sep', time: '15:36', items: [{ product: 3, quantity: 3 }, { product: 2, quantity: 2 }] },
  { id: 'V-006', month: 1, date: '28 sep', time: '09:52', items: [{ product: 0, quantity: 3 }, { product: 4, quantity: 1 }] },
];

export const money = (value: number) => `$ ${new Intl.NumberFormat('es-CO').format(value)}`;
export const saleTotal = (sale: (typeof sales)[number]) => sale.items.reduce((sum, item) => sum + products[item.product].price * item.quantity, 0);
export const stockTotal = products.reduce((sum, product) => sum + product.stock, 0);
export const lowStock = products.filter((product) => product.stock <= product.minimum);

export function monthlySummary(month: number) {
  const records = sales.filter((sale) => sale.month === month);
  const ranking = products.map((product, index) => ({
    name: product.name,
    quantity: records.reduce((sum, sale) => sum + sale.items.filter((item) => item.product === index).reduce((count, item) => count + item.quantity, 0), 0),
  })).sort((a, b) => b.quantity - a.quantity);
  const total = records.reduce((sum, sale) => sum + saleTotal(sale), 0);
  const previous = sales.filter((sale) => sale.month === month - 1).reduce((sum, sale) => sum + saleTotal(sale), 0);
  return { records, ranking, total, most: ranking.filter((item) => item.quantity === ranking[0].quantity), least: ranking.filter((item) => item.quantity === ranking[ranking.length - 1].quantity), units: ranking.reduce((sum, item) => sum + item.quantity, 0), change: previous > 0 ? Math.round(((total - previous) / previous) * 100) : null };
}
