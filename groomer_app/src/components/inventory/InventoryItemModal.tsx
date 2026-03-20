'use client'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormModal } from '@/components/ui/FormModal'

type Item = {
  id: string
  name: string
  category: string | null
  unit: string
  supplier_name: string | null
  jan_code: string | null
  optimal_stock: number
  reorder_point: number
  lead_time_days: number
  preferred_supplier_name: string | null
  minimum_order_quantity: number
  order_lot_size: number
  is_active: boolean
  notes: string | null
}

type InventoryItemModalProps = {
  currentEdit: Item | null
  modalCloseRedirect: string
}

export function InventoryItemModal({
  currentEdit,
  modalCloseRedirect,
}: InventoryItemModalProps) {
  return (
    <FormModal
      title={currentEdit ? '商品情報の更新' : '新規商品登録'}
      closeRedirectTo={modalCloseRedirect}
      description="商品情報はモーダルで入力します。"
      reopenLabel="商品モーダルを開く"
    >
      <form
        action={currentEdit ? `/api/inventory/items/${currentEdit.id}` : '/api/inventory/items'}
        method="post"
        className="space-y-4"
      >
        {currentEdit ? <input type="hidden" name="_method" value="put" /> : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-gray-700">
            商品名
            <Input name="name" required defaultValue={currentEdit?.name ?? ''} />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            カテゴリ
            <Input name="category" defaultValue={currentEdit?.category ?? ''} />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            単位
            <Input name="unit" defaultValue={currentEdit?.unit ?? '個'} />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            仕入先
            <Input name="supplier_name" defaultValue={currentEdit?.supplier_name ?? ''} />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            推奨仕入先
            <Input
              name="preferred_supplier_name"
              defaultValue={currentEdit?.preferred_supplier_name ?? ''}
            />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            JANコード
            <Input name="jan_code" defaultValue={currentEdit?.jan_code ?? ''} />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            適正在庫
            <Input
              type="number"
              step="0.01"
              name="optimal_stock"
              defaultValue={String(currentEdit?.optimal_stock ?? 0)}
            />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            発注点
            <Input
              type="number"
              step="0.01"
              name="reorder_point"
              defaultValue={String(currentEdit?.reorder_point ?? 0)}
            />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            リードタイム日数
            <Input
              type="number"
              min="0"
              step="1"
              name="lead_time_days"
              defaultValue={String(currentEdit?.lead_time_days ?? 0)}
            />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            最小発注数
            <Input
              type="number"
              step="0.01"
              min="0"
              name="minimum_order_quantity"
              defaultValue={String(currentEdit?.minimum_order_quantity ?? 1)}
            />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            発注ロット
            <Input
              type="number"
              step="0.01"
              min="0"
              name="order_lot_size"
              defaultValue={String(currentEdit?.order_lot_size ?? 1)}
            />
          </label>
          <label className="space-y-2 text-sm text-gray-700">
            状態
            <select
              name="is_active"
              defaultValue={currentEdit?.is_active === false ? 'false' : 'true'}
              className="w-full rounded border p-2 outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="true">有効</option>
              <option value="false">無効</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
            備考
            <Input name="notes" defaultValue={currentEdit?.notes ?? ''} />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit">{currentEdit ? '更新する' : '登録する'}</Button>
        </div>
      </form>
    </FormModal>
  )
}
