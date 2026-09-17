import { useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, DrawerClose, DrawerContent } from 'src/components/common/Drawer';
import { Button } from 'src/components/common/Button';
import { Input } from 'src/components/common/Input';
import { useCreateProduct } from 'src/hooks/common/useBusinessMutations';
import { useCategories } from 'src/hooks/common/useBusinessData';
import { parseMoney } from 'src/utils/money';

interface AddProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The organization's currency — decides how typed prices are parsed. */
  currency: string;
}

/**
 * Adds a product.
 *
 * Presented as a right-hand drawer rather than a centred dialog: this is a
 * seven-field form, and at that size a centred box is a page pretending to be
 * a dialog. The drawer keeps the catalogue visible beside it, which is what
 * makes adding three products in a row feel like working on the list rather
 * than leaving it. See `components/common/Drawer.tsx`.
 *
 * ## Why the price fields are strings in state
 *
 * They hold exactly what the user typed, and are converted to integer minor
 * units by `parseMoney` at submit. Binding them to a `number` would push the
 * value through a float on every keystroke, and `1.005` would already have
 * become `1.00499…` before anything could round it correctly.
 *
 * That is the same reasoning as the backend's own string-parsing path, applied
 * at the other end of the wire.
 */
export function AddProductModal({ open, onOpenChange, currency }: AddProductModalProps) {
  const { t } = useTranslation();
  const createProduct = useCreateProduct();
  const { data: categories } = useCategories();

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [sellingPrice, setSellingPrice] = useState('');
  const [reorderLevel, setReorderLevel] = useState('0');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setSku('');
    setBarcode('');
    setCategory('');
    setUnit('pcs');
    setSellingPrice('');
    setReorderLevel('0');
    setError(null);
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault();

    const price = parseMoney(sellingPrice, currency);

    if (price === null) {
      setError(t('FORM_REQUIRED'));

      return;
    }

    setError(null);

    createProduct.mutate(
      {
        name,
        sku,
        barcode: barcode || undefined,
        category: category || undefined,
        unit,
        sellingPrice: price,
        reorderLevel: Number(reorderLevel) || 0,
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      }
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        drawerTitle={t('PRODUCTS_ADD')}
        description={t('PRODUCTS_ADD_HINT')}
        footer={
          <>
            <DrawerClose asChild>
              <Button type="button" variant="secondary">
                {t('BUTTON_CANCEL')}
              </Button>
            </DrawerClose>
            {/* Outside the <form>, so it is wired by `form=` id instead. */}
            <Button type="submit" form="add-product-form" disabled={createProduct.isPending}>
              {createProduct.isPending ? t('LOADING') : t('BUTTON_SAVE')}
            </Button>
          </>
        }
      >
        <form id="add-product-form" onSubmit={submit} className="flex flex-col gap-4">
          <Input
            label={t('PRODUCTS_NAME')}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={t('PRODUCTS_SKU')}
              value={sku}
              onChange={(event) => {
                setSku(event.target.value);
              }}
              required
            />
            <Input
              label={t('PRODUCTS_BARCODE')}
              value={barcode}
              onChange={(event) => {
                setBarcode(event.target.value);
              }}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={`${t('PRODUCTS_PRICE')} (${currency})`}
              value={sellingPrice}
              onChange={(event) => {
                setSellingPrice(event.target.value);
              }}
              inputMode="decimal"
              required
              {...(error ? { error } : {})}
            />
            <Input
              label={t('PRODUCTS_UNIT')}
              value={unit}
              onChange={(event) => {
                setUnit(event.target.value);
              }}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="product-category" className="text-foreground text-sm font-medium">
                {t('PRODUCTS_CATEGORY')}
              </label>
              <select
                id="product-category"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                }}
                className="border-border bg-surface text-foreground rounded-md border px-3 py-2 text-sm"
              >
                <option value="">{t('NONE')}</option>
                {(categories ?? []).map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label={t('PRODUCTS_REORDER_LEVEL')}
              value={reorderLevel}
              onChange={(event) => {
                setReorderLevel(event.target.value);
              }}
              inputMode="numeric"
            />
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
