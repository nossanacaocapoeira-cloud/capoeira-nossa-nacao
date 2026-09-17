import React, { useEffect, useState } from 'react';
import { Modal } from '../../common/Modal';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { dbService } from '../../../lib/dbService';
import { Product } from '../../../types/database';
import { formatCurrency } from '../../../lib/utils';

interface AddProductDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  onSuccess: () => void;
}

export function AddProductDebtModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  onSuccess,
}: AddProductDebtModalProps) {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      dbService.getProducts().then((list) => {
        setProducts(list.filter((p) => p.active));
        if (list.length > 0) {
          const first = list[0];
          setSelectedProductId(first.id);
          setProductName(first.name);
          setUnitPrice(Number(first.price));
        }
      });
    }
  }, [isOpen]);

  const handleProductSelect = (prodId: string) => {
    setSelectedProductId(prodId);
    if (prodId === 'custom') {
      setProductName('');
      setUnitPrice(0);
    } else {
      const found = products.find((p) => p.id === prodId);
      if (found) {
        setProductName(found.name);
        setUnitPrice(Number(found.price));
      }
    }
  };

  const totalCalculated = Number((quantity * unitPrice).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      error('Informe o nome do produto.');
      return;
    }
    if (quantity <= 0) {
      error('A quantidade deve ser maior que zero.');
      return;
    }
    if (unitPrice < 0) {
      error('O preço unitário não pode ser negativo.');
      return;
    }

    setLoading(true);
    try {
      await dbService.addProductDebt({
        studentId,
        productId: selectedProductId !== 'custom' ? selectedProductId : null,
        productName: productName.trim(),
        quantity,
        unitPrice,
        notes: notes.trim() || undefined,
        adminId: user?.id,
        adminEmail: user?.email || undefined,
      });

      success(`Produto "${productName}" adicionado em débito com sucesso!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      error(`Erro ao adicionar produto: ${err?.message || 'Tente novamente'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Adicionar Produto em Débito • ${studentName}`} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
            Selecione do Catálogo
          </label>
          <select
            id="select-catalog-product"
            value={selectedProductId}
            onChange={(e) => handleProductSelect(e.target.value)}
            className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 font-medium focus:border-amber-500 outline-none"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatCurrency(p.price)} ({p.category})
              </option>
            ))}
            <option value="custom">Outro produto (digitar manualmente)...</option>
          </select>
        </div>

        {selectedProductId === 'custom' && (
          <div>
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
              Nome do Produto <span className="text-amber-400">*</span>
            </label>
            <input
              id="input-custom-product-name"
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              required
              placeholder="Ex: Camiseta Edição Especial"
              className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 focus:border-amber-500 outline-none"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
              Quantidade <span className="text-amber-400">*</span>
            </label>
            <input
              id="input-product-quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              required
              className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 font-mono font-bold focus:border-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
              Preço Unitário (R$) <span className="text-amber-400">*</span>
            </label>
            <input
              id="input-product-unit-price"
              type="number"
              step="0.01"
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
              required
              className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 font-mono font-bold focus:border-amber-500 outline-none"
            />
          </div>
        </div>

        {/* Total Calculated Banner */}
        <div className="p-3 bg-[#111214] border border-[#26282e] rounded-xl flex items-center justify-between">
          <span className="text-neutral-400 uppercase tracking-wider font-mono">Total em Débito:</span>
          <span className="text-base font-black text-amber-400 font-mono">
            {formatCurrency(totalCalculated)}
          </span>
        </div>

        <div>
          <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
            Observação (Opcional)
          </label>
          <input
            id="input-product-debt-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Pegou no treino de terça, tamanho M"
            className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 focus:border-amber-500 outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#23252b]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-neutral-400 hover:text-white rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            id="btn-confirm-add-product-debt"
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold rounded-xl shadow transition"
          >
            {loading ? 'Adicionando...' : 'Adicionar Débito'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
