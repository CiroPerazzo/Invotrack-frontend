import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCompany } from '@/features/companies/context/CompanyContext'
import { useProviders } from '@/features/providers/hooks/useProviders'
import { useProducts } from '@/features/products/hooks/useProducts'
import { purchaseOrderService } from '@/features/purchase-orders/services/purchaseOrderService'
import { invoiceService } from '@/features/invoices/services/invoiceService'

const newItem = () => ({ product_id: null, description: '', quantity: 1, unit_price: 0, iva_rate: 0 })
const newOrder = () => ({ provider_id: '', order_number: '', issue_date: new Date().toISOString().slice(0, 10), status: 'draft', notes: '', items: [newItem()] })
const money = (value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(value ?? 0))
const labels = { draft: 'Borrador', pending: 'Sin facturar', partially_invoiced: 'Parcialmente facturada', invoiced: 'Facturada', cancelled: 'Cancelada' }

export default function PurchaseOrdersPage() {
  const { company, role: companyRole } = useCompany()
  const companyId = company?.id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: providersResult } = useProviders({ companyId, pageSize: 100 })
  const { data: productsResult } = useProducts()
  const providers = providersResult?.data ?? []
  const products = productsResult?.data ?? []
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState([])
  const [amounts, setAmounts] = useState({})
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState(null)
  const [attach, setAttach] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canWrite = companyRole === 'admin' || companyRole === 'accountant'
  const { data: result, isLoading, error: loadError } = useQuery({
    queryKey: ['purchase-orders', companyId, page],
    queryFn: () => purchaseOrderService.list(companyId, page),
    enabled: Boolean(companyId && !company?._isDemo),
  })
  const orders = result?.data ?? []

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['purchase-orders', companyId] })
  const run = async (action) => {
    setBusy(true)
    setError('')
    try { await action() } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const openDetail = (id) => run(async () => setDetail(await purchaseOrderService.get(companyId, id)))
  const edit = () => setForm({
    provider_id: detail.provider_id, order_number: detail.order_number, issue_date: detail.issue_date,
    status: detail.status, notes: detail.notes ?? '',
    items: detail.items.map(({ product_id, description, quantity, unit_price, iva_rate }) => ({ product_id, description, quantity, unit_price, iva_rate })),
    id: detail.id,
  })
  const save = (event) => {
    event.preventDefault()
    run(async () => {
      const { id, ...payload } = form
      const response = id
        ? await purchaseOrderService.update(companyId, id, payload)
        : await purchaseOrderService.create(companyId, payload)
      setForm(null)
      setDetail(await purchaseOrderService.get(companyId, response.id))
      refresh()
    })
  }
  const updateItem = (index, patch) => setForm((current) => ({
    ...current, items: current.items.map((item, i) => i === index ? { ...item, ...patch } : item),
  }))
  const group = () => run(async () => {
    const preview = await purchaseOrderService.preview(companyId, selected)
    const provider = providers.find((entry) => entry.id === preview.provider_id)
    if (!provider) throw new Error('No se encontró el proveedor. Recargá la página.')
    const selectedOrders = preview.orders.map((order) => ({ ...order, selected_amount: Number(amounts[order.id] ?? order.remaining_amount) }))
    if (selectedOrders.some((order) => !Number.isFinite(order.selected_amount) || order.selected_amount <= 0 || order.selected_amount > Number(order.remaining_amount))) {
      throw new Error('Cada importe debe ser mayor a cero y menor o igual al saldo de su orden')
    }
    navigate('/invoices/new', { state: { purchaseOrderGroup: {
      ...preview, provider, orders: selectedOrders,
      total_selected: selectedOrders.reduce((sum, order) => sum + order.selected_amount, 0),
    } } })
  })
  const openAttach = () => run(async () => {
    const preview = await purchaseOrderService.preview(companyId, selected)
    const selectedOrders = preview.orders.map((order) => ({ ...order, selected_amount: Number(amounts[order.id] ?? order.remaining_amount) }))
    if (selectedOrders.some((order) => !Number.isFinite(order.selected_amount) || order.selected_amount <= 0 || order.selected_amount > Number(order.remaining_amount))) {
      throw new Error('Cada importe debe ser mayor a cero y menor o igual al saldo de su orden')
    }
    const result = await invoiceService.getAll({ companyId, type: 'payable', pageSize: 100 })
    setAttach({
      preview: { ...preview, orders: selectedOrders },
      invoiceId: '',
      invoices: result.data.filter((invoice) => invoice.provider_id === preview.provider_id && invoice.status !== 'cancelled'),
    })
  })
  const attachInvoice = () => run(async () => {
    if (!attach?.invoiceId) throw new Error('Seleccioná una factura')
    await purchaseOrderService.allocate(companyId, attach.invoiceId, attach.preview.orders.map((order) => ({
      purchase_order_id: order.id,
      allocated_amount: order.selected_amount,
    })))
    setAttach(null)
    setSelected([])
    refresh()
    queryClient.invalidateQueries({ queryKey: ['invoice-purchase-orders', companyId, attach.invoiceId] })
  })

  if (company?._isDemo) return <div className="p-6 text-gray-500">Las órdenes de compra están disponibles en empresas reales.</div>
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between gap-3">
        <div><p className="font-mono text-xs uppercase tracking-widest text-blue-400">Compras</p><h1 className="text-2xl font-bold text-gray-900">Órdenes de compra</h1></div>
        {canWrite && <Button onClick={() => { setDetail(null); setForm(newOrder()) }}><Plus className="h-4 w-4" /> Nueva orden</Button>}
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-500">{error}</p>}
      {loadError && <p role="alert" className="text-red-500">{loadError.message}</p>}
      {selected.length > 0 && canWrite && (
        <div className="flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
          <span className="text-sm text-gray-700">{selected.length} órdenes seleccionadas del mismo proveedor.</span>
          <div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={openAttach}>Asociar existente</Button><Button disabled={busy} onClick={group}><FileText className="h-4 w-4" /> Crear factura agrupada</Button></div>
        </div>
      )}
      {selected.length > 0 && <div className="grid gap-2 sm:grid-cols-2">
        {selected.map((id) => { const order = orders.find((row) => row.id === id); return order && <label key={id} className="rounded-lg border border-gray-200 bg-panel p-3 text-sm text-gray-700">
          Importe a facturar de {order.order_number} · saldo {money(order.remaining_amount)}
          <Input type="number" min="0.01" max={order.remaining_amount} step="0.01" value={amounts[id] ?? order.remaining_amount} onChange={(event) => setAmounts({ ...amounts, [id]: event.target.value })} />
        </label> })}
      </div>}
      {attach && <section className="rounded-xl border border-gray-200 bg-panel p-4 space-y-3">
        <h2 className="font-semibold text-gray-900">Asociar factura recibida</h2>
        <p className="text-sm text-gray-500">Proveedor único · Importe a asociar {money(attach.preview.orders.reduce((sum, order) => sum + order.selected_amount, 0))}.</p>
        <select className="w-full h-9 rounded-md border border-gray-200 bg-panel px-3" value={attach.invoiceId} onChange={(event) => setAttach({ ...attach, invoiceId: event.target.value })}>
          <option value="">Seleccioná una factura existente</option>
          {attach.invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} · {money(invoice.total_amount)}</option>)}
        </select>
        {attach.invoices.length === 0 && <p className="text-sm text-gray-500">No hay facturas recibidas de este proveedor entre las últimas 100.</p>}
        <div className="flex gap-2"><Button disabled={busy || !attach.invoiceId} onClick={attachInvoice}>Asociar</Button><Button variant="ghost" onClick={() => setAttach(null)}>Cerrar</Button></div>
      </section>}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-panel">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100/60 text-gray-500"><tr><th className="p-3">Seleccionar</th><th className="p-3">Número</th><th className="p-3">Proveedor</th><th className="p-3">Fecha</th><th className="p-3">Total</th><th className="p-3">Facturado</th><th className="p-3">Estado</th></tr></thead>
          <tbody>{orders.map((row) => {
            const selectable = row.status === 'pending' && Number(row.remaining_amount) > 0
            return <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-100/40">
              <td className="p-3"><input type="checkbox" aria-label={`Seleccionar orden ${row.order_number}`} disabled={!selectable || !canWrite} checked={selected.includes(row.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} /></td>
              <td className="p-3"><button className="text-blue-500 hover:underline font-medium" onClick={() => openDetail(row.id)}>{row.order_number}</button></td>
              <td className="p-3">{providers.find((provider) => provider.id === row.provider_id)?.name ?? row.provider_id}</td>
              <td className="p-3">{row.issue_date}</td><td className="p-3">{money(row.total_amount)}</td><td className="p-3">{money(row.invoiced_amount)}</td>
              <td className="p-3">{labels[row.billing_status]}</td>
            </tr>
          })}</tbody>
        </table>
        {isLoading && <p className="p-5 text-gray-500">Cargando órdenes...</p>}
        {!isLoading && orders.length === 0 && <p className="p-5 text-gray-500">Todavía no hay órdenes de compra.</p>}
      </div>
      <div className="flex items-center gap-3"><Button variant="outline" disabled={page === 1} onClick={() => { setPage(page - 1); setSelected([]) }}>Anterior</Button><span className="text-sm text-gray-500">Página {page}</span><Button variant="outline" disabled={page * 20 >= (result?.count ?? 0)} onClick={() => { setPage(page + 1); setSelected([]) }}>Siguiente</Button></div>

      {detail && !form && <section className="rounded-xl border border-gray-200 bg-panel p-5 space-y-4">
        <div className="flex justify-between"><h2 className="text-lg font-semibold text-gray-900">Orden {detail.order_number}</h2><Button variant="ghost" onClick={() => setDetail(null)}>Cerrar</Button></div>
        <p className="text-sm text-gray-600">{labels[detail.billing_status]} · Total {money(detail.total_amount)} · Facturado {money(detail.invoiced_amount)} · Saldo {money(detail.remaining_amount)}</p>
        <div className="space-y-1">{detail.items.map((item) => <p key={item.id} className="text-sm text-gray-700">{item.description} · {item.quantity} × {money(item.unit_price)} · IVA {item.iva_rate}% · {money(item.line_total)}</p>)}</div>
        <div><h3 className="font-medium text-gray-900">Facturas asociadas</h3>{detail.invoices.length ? detail.invoices.map((link) => <p key={link.invoice_id} className="text-sm text-gray-700"><a className="text-blue-500 hover:underline" href={`/invoices/${link.invoice_id}`}>{link.invoices?.invoice_number ?? link.invoice_id}</a> · {money(link.allocated_amount)}</p>) : <p className="text-sm text-gray-500">Sin facturas</p>}</div>
        {canWrite && detail.invoices.length === 0 && <div className="flex gap-2">{detail.status !== 'cancelled' && <><Button variant="outline" onClick={edit}>Editar</Button><Button variant="outline" disabled={busy} onClick={() => run(async () => { await purchaseOrderService.cancel(companyId, detail.id); setDetail(null); refresh() })}>Cancelar orden</Button></>}{companyRole === 'admin' && <Button variant="destructive" disabled={busy} onClick={() => run(async () => { await purchaseOrderService.delete(companyId, detail.id); setDetail(null); refresh() })}>Eliminar</Button>}</div>}
      </section>}

      {form && <form onSubmit={save} className="rounded-xl border border-gray-200 bg-panel p-5 space-y-4">
        <div className="flex justify-between"><h2 className="text-lg font-semibold text-gray-900">{form.id ? 'Editar orden' : 'Nueva orden'}</h2><Button type="button" variant="ghost" onClick={() => setForm(null)}>Cerrar</Button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-gray-700">Número de orden<Input required maxLength={80} value={form.order_number} onChange={(event) => setForm({ ...form, order_number: event.target.value })} /></label>
          <label className="text-sm text-gray-700">Fecha<Input type="date" required value={form.issue_date} onChange={(event) => setForm({ ...form, issue_date: event.target.value })} /></label>
          <label className="text-sm text-gray-700">Proveedor<select required className="w-full h-9 rounded-md border border-gray-200 bg-panel px-3" value={form.provider_id} onChange={(event) => setForm({ ...form, provider_id: event.target.value })}><option value="">Seleccioná un proveedor</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
          <label className="text-sm text-gray-700">Estado<select className="w-full h-9 rounded-md border border-gray-200 bg-panel px-3" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Borrador</option><option value="pending">Pendiente</option></select></label>
        </div>
        <label className="block text-sm text-gray-700">Notas<Input maxLength={5000} value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        <h3 className="font-medium text-gray-900">Ítems</h3>
        {form.items.map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-6 items-end border-b border-gray-100 pb-3">
          <label className="text-xs text-gray-500 sm:col-span-2">Descripción<Input required maxLength={500} value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} /></label>
          <label className="text-xs text-gray-500">Producto<select className="w-full h-9 rounded-md border border-gray-200 bg-panel px-2" value={item.product_id ?? ''} onChange={(event) => { const product = products.find((entry) => entry.id === event.target.value); updateItem(index, { product_id: product?.id ?? null, description: product?.name ?? item.description, unit_price: product?.price ?? item.unit_price }) }}><option value="">Sin catálogo</option>{products.filter((product) => !product.provider_id || product.provider_id === form.provider_id).map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label className="text-xs text-gray-500">Cantidad<Input type="number" required min="0.0001" step="0.0001" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} /></label>
          <label className="text-xs text-gray-500">Precio<Input type="number" required min="0" step="0.01" value={item.unit_price} onChange={(event) => updateItem(index, { unit_price: event.target.value })} /></label>
          <label className="text-xs text-gray-500">IVA %<div className="flex gap-1"><select className="w-full h-9 rounded-md border border-gray-200 bg-panel px-2" value={item.iva_rate} onChange={(event) => updateItem(index, { iva_rate: Number(event.target.value) })}>{[0, 10.5, 21, 27].map((rate) => <option key={rate} value={rate}>{rate}%</option>)}</select><Button type="button" variant="ghost" size="icon" aria-label="Quitar ítem" disabled={form.items.length === 1} onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button></div></label>
        </div>)}
        <Button type="button" variant="outline" onClick={() => setForm({ ...form, items: [...form.items, newItem()] })}>Agregar ítem</Button>
        <div className="flex justify-end"><Button type="submit" disabled={busy}>Guardar orden</Button></div>
      </form>}
    </div>
  )
}
