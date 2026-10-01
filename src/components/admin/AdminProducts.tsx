import React, { useEffect, useState, useCallback } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { dbService, getDeletedRecordsRegistry } from '../../lib/dbService';
import { supabase } from '../../lib/supabase';
import { Product, ProductDebt } from '../../types/database';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Modal } from '../common/Modal';
import { useToast } from '../../contexts/ToastContext';
import { RecordPaymentModal } from './modals/RecordPaymentModal';
import { EmptyState } from '../common/EmptyState';
import { ShoppingBag, Plus, Search, CheckCircle2, Clock, RefreshCw, Tag, Edit2 } from 'lucide-react';

export function AdminProducts() {
  const { navigate, getParam } = useNavigation();
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState<'debts' | 'catalog'>(() => {
    const urlTab = getParam('tab');
    if (urlTab === 'catalog') return 'catalog';
    return 'debts';
  });

  useEffect(() => {
    const urlTab = getParam('tab');
    if (urlTab === 'catalog') setActiveTab('catalog');
    else if (urlTab === 'debts') setActiveTab('debts');
  }, [getParam]);

  // Debts state
  const [debts, setDebts] = useState<(ProductDebt & { student?: { full_name: string; nickname?: string } })[]>([]);
  const [loadingDebts, setLoadingDebts] = useState(true);

  // Catalog state
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // New/Edit product modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'Uniforme',
    price: 80,
    description: '',
    active: true,
  });
  const [savingProduct, setSavingProduct] = useState(false);

  // Payoff modal
  const [paymentModalData, setPaymentModalData] = useState<{
    isOpen: boolean;
    studentId: string;
    studentName: string;
    productDebtId: string;
    itemTitle: string;
    openBalance: number;
  }>({
    isOpen: false,
    studentId: '',
    studentName: '',
    productDebtId: '',
    itemTitle: '',
    openBalance: 0,
  });

  const loadDebts = useCallback(async () => {
    try {
      const [debtsRes, profRes, deletedReg] = await Promise.all([
        supabase
          .from('product_debts')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('*'),
        getDeletedRecordsRegistry(),
      ]);

      const profileMap = new Map<string, { full_name: string; nickname?: string }>();
      for (const p of profRes.data || []) {
        profileMap.set(p.id, { full_name: p.full_name, nickname: p.nickname });
      }

      const enriched = (debtsRes.data || [])
        .filter((d: any) => !d.deleted_at && d.status !== 'cancelled' && !deletedReg.debtIds.has(d.id))
        .map((d: any) => ({
          ...d,
          student: d.student || profileMap.get(d.student_id) || undefined,
        }));

      setDebts(enriched);
    } catch (err) {
      console.error('Erro ao carregar débitos de produtos:', err);
    } finally {
      setLoadingDebts(false);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const data = await dbService.getProducts();
      setProducts(data);
    } catch (err) {
      console.error('Erro ao carregar catálogo de produtos:', err);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    loadDebts();
    loadCatalog();
    const onFinancialUpdated = () => {
      loadDebts();
    };
    window.addEventListener('capoeira:financial_updated', onFinancialUpdated);
    return () => window.removeEventListener('capoeira:financial_updated', onFinancialUpdated);
  }, [loadDebts, loadCatalog]);

  const openNewProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      category: 'Uniforme',
      price: 80,
      description: '',
      active: true,
    });
    setShowProductModal(true);
  };

  const openEditProductModal = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      category: p.category,
      price: Number(p.price),
      description: p.description || '',
      active: p.active,
    });
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      error('Informe o nome do produto.');
      return;
    }
    if (productForm.price < 0) {
      error('O preço não pode ser negativo.');
      return;
    }

    setSavingProduct(true);
    try {
      if (editingProduct) {
        const { error: updErr } = await supabase
          .from('products')
          .update({
            name: productForm.name.trim(),
            category: productForm.category,
            price: productForm.price,
            description: productForm.description.trim() || null,
            active: productForm.active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingProduct.id);

        if (updErr) throw updErr;
        success('Produto atualizado no catálogo!');
      } else {
        const { error: insErr } = await supabase.from('products').insert({
          name: productForm.name.trim(),
          category: productForm.category,
          price: productForm.price,
          description: productForm.description.trim() || null,
          active: productForm.active,
        });

        if (insErr) throw insErr;
        success('Produto adicionado ao catálogo!');
      }

      setShowProductModal(false);
      loadCatalog();
    } catch (err: any) {
      error(`Erro ao salvar produto: ${err?.message || 'Tente novamente'}`);
    } finally {
      setSavingProduct(false);
    }
  };

  const openDebtsOnly = debts.filter(
    (d) => Number(d.remaining_amount) > 0 && d.status !== 'paid' && d.status !== 'cancelled'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-amber-400">
            Produtos & Materiais
          </span>
          <h2 className="text-2xl font-black tracking-tight text-neutral-100">
            Vendas & Débitos de Produtos
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Gerencie o catálogo de produtos e acompanhe débitos de alunos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadDebts();
              loadCatalog();
            }}
            className="p-2 text-neutral-400 hover:text-white bg-[#141619] border border-[#25282f] rounded-xl transition"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            id="btn-new-catalog-product"
            onClick={openNewProductModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-xl shadow transition"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Produto no Catálogo</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-[#141619] border border-[#25282f] rounded-xl text-xs w-full sm:w-fit">
        <button
          id="tab-admin-product-debts"
          onClick={() => {
            setActiveTab('debts');
            navigate('/admin/produtos?tab=debts');
          }}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold transition ${
            activeTab === 'debts'
              ? 'bg-amber-500 text-neutral-950 shadow'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Débitos em Aberto ({openDebtsOnly.length})
        </button>

        <button
          id="tab-admin-product-catalog"
          onClick={() => {
            setActiveTab('catalog');
            navigate('/admin/produtos?tab=catalog');
          }}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold transition ${
            activeTab === 'catalog'
              ? 'bg-amber-500 text-neutral-950 shadow'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Catálogo da Academia ({products.length})
        </button>
      </div>

      {/* Tab: Débitos */}
      {activeTab === 'debts' ? (
        loadingDebts ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-[#141619] border border-[#25282f] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : openDebtsOnly.length === 0 ? (
          <EmptyState
            title="Nenhum débito de produto em aberto!"
            description="Todos os produtos entregues aos alunos estão devidamente quitados."
            icon={CheckCircle2}
          />
        ) : (
          <div className="space-y-3">
            {openDebtsOnly.map((debt) => {
              const studentName = debt.student?.nickname || debt.student?.full_name || 'Aluno';

              return (
                <div
                  key={debt.id}
                  className="p-4 rounded-2xl bg-[#141619] border border-[#25282f] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-neutral-100">
                        {debt.student?.full_name}
                      </span>
                      {debt.student?.nickname && (
                        <span className="text-xs text-amber-400 font-semibold">
                          ({debt.student?.nickname})
                        </span>
                      )}
                      <span className="text-xs text-neutral-500">•</span>
                      <span className="text-xs font-bold text-neutral-200">
                        {debt.product_name_snapshot}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono text-neutral-400">
                      <span>Qtd: {debt.quantity}</span>
                      <span>Total: {formatCurrency(debt.total_amount)}</span>
                      <span className="text-emerald-400">Pago: {formatCurrency(debt.amount_paid)}</span>
                      <span className="text-amber-400 font-bold">
                        Saldo: {formatCurrency(debt.remaining_amount)}
                      </span>
                      <span className="text-neutral-500">Data: {formatDate(debt.created_at)}</span>
                    </div>

                    {debt.notes && <p className="text-[11px] text-neutral-500 italic">{debt.notes}</p>}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-950 text-amber-300 border border-amber-500/40">
                      <Clock className="w-3 h-3" />
                      Em Aberto
                    </span>

                    <button
                      id={`btn-payoff-product-debt-${debt.id}`}
                      onClick={() =>
                        setPaymentModalData({
                          isOpen: true,
                          studentId: debt.student_id,
                          studentName,
                          productDebtId: debt.id,
                          itemTitle: `Produto: ${debt.product_name_snapshot}`,
                          openBalance: Number(debt.remaining_amount),
                        })
                      }
                      className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold rounded-xl shadow transition flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Dar Baixa</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Tab: Catálogo */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <div
              key={p.id}
              className="p-5 rounded-2xl bg-[#141619] border border-[#25282f] space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    {p.category}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      p.active ? 'text-emerald-400 bg-emerald-500/10' : 'text-neutral-500 bg-neutral-800'
                    }`}
                  >
                    {p.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <h3 className="font-bold text-base text-neutral-100 mt-2">{p.name}</h3>
                <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                  {p.description || 'Sem descrição cadastrada'}
                </p>
              </div>

              <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
                <span className="text-base font-black text-neutral-100 font-mono">
                  {formatCurrency(p.price)}
                </span>

                <button
                  onClick={() => openEditProductModal(p)}
                  className="p-2 text-neutral-400 hover:text-white bg-[#1a1d22] rounded-lg transition"
                  title="Editar produto"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New / Edit Product Modal */}
      <Modal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        title={editingProduct ? 'Editar Produto do Catálogo' : 'Novo Produto para o Catálogo'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
              Nome do Produto <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              required
              placeholder="Ex: Camiseta Oficial CNN, Abadá, Corda Azul..."
              className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 focus:border-amber-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Categoria
              </label>
              <select
                value={productForm.category}
                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 focus:border-amber-500 outline-none"
              >
                <option value="Camiseta">Camiseta</option>
                <option value="Calça">Calça de Capoeira</option>
                <option value="Abadá">Abadá</option>
                <option value="Corda">Corda</option>
                <option value="Uniforme">Uniforme</option>
                <option value="Acessórios">Acessórios</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Preço Padrão (R$) <span className="text-amber-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={productForm.price}
                onChange={(e) => setProductForm({ ...productForm, price: parseFloat(e.target.value) || 0 })}
                required
                className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 font-mono font-bold focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-neutral-300 uppercase tracking-wider mb-1">
              Descrição (Opcional)
            </label>
            <input
              type="text"
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              placeholder="Ex: Malha 100% algodão, tecido helanca branca, etc."
              className="w-full px-3 py-2 bg-[#111214] border border-neutral-700 rounded-xl text-neutral-100 focus:border-amber-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="product-active-toggle"
              checked={productForm.active}
              onChange={(e) => setProductForm({ ...productForm, active: e.target.checked })}
              className="rounded bg-neutral-800 border-neutral-700 text-amber-500"
            />
            <label htmlFor="product-active-toggle" className="text-neutral-300">
              Disponível para venda no catálogo
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#23252b]">
            <button
              type="button"
              onClick={() => setShowProductModal(false)}
              className="px-4 py-2 text-neutral-400 hover:text-white rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingProduct}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold rounded-xl shadow transition"
            >
              {savingProduct ? 'Salvando...' : 'Salvar Produto'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Payoff Modal */}
      <RecordPaymentModal
        isOpen={paymentModalData.isOpen}
        onClose={() => setPaymentModalData((prev) => ({ ...prev, isOpen: false }))}
        studentId={paymentModalData.studentId}
        studentName={paymentModalData.studentName}
        paymentType="product"
        itemTitle={paymentModalData.itemTitle}
        productDebtId={paymentModalData.productDebtId}
        openBalance={paymentModalData.openBalance}
        onSuccess={loadDebts}
      />
    </div>
  );
}
