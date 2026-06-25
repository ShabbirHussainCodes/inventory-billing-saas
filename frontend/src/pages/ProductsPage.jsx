import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import { inventoryAPI } from "../services/api"

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const res = await inventoryAPI.getProducts()
      setProducts(res.data)
    } catch (err) {
      console.error("Error:", err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading products...</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Products</h2>
          <p className="text-gray-500 mt-1">
            Manage your inventory
          </p>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Product</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">SKU</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Cost Price</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Sell Price</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Margin</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Stock</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                  No products yet. Add your first product!
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-800">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.category_name || "No category"}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{product.sku}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{product.cost_price}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{product.selling_price}</td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-green-600">
                      {product.profit_margin}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {product.stock_quantity}
                  </td>
                  <td className="px-6 py-4">
                    {product.is_low_stock ? (
                      <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs font-medium">
                        Low Stock 🔴
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-green-100 text-green-600 rounded-full text-xs font-medium">
                        In Stock ✅
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}