import React, { useState, useEffect } from 'react';
import { getProducts, deleteProduct, uploadExcel } from '../services/products';
import ProductModal from '../components/ProductModal';
import '../styles/Products.css';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await getProducts();
      setProducts(data.products || []);
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      await deleteProduct(productId);
      loadProducts();
    } catch (err) {
      alert('Failed to delete product');
    }
  };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setShowModal(true);
  };

  const handleAdd = () => {
    setSelectedProduct(null);
    setShowModal(true);
  };

  const handleModalClose = (refresh) => {
    setShowModal(false);
    setSelectedProduct(null);
    if (refresh) {
      loadProducts();
    }
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadStatus('Uploading...');
      const result = await uploadExcel(file);
      setUploadStatus(`Success! Added ${result.added || 0}, Updated ${result.updated || 0} products`);
      loadProducts();
      setTimeout(() => setUploadStatus(''), 5000);
    } catch (err) {
      setUploadStatus('Upload failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="products-container">
      <div className="products-header">
        <h1>Product Management</h1>
        <div className="header-actions">
          <label className="excel-upload-btn">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
            {uploading ? 'Uploading...' : 'Upload Excel'}
          </label>
          <button onClick={handleAdd} className="add-button">Add Product</button>
        </div>
      </div>

      {uploadStatus && (
        <div className={`upload-status ${uploadStatus.includes('Success') ? 'success' : 'error'}`}>
          {uploadStatus}
        </div>
      )}

      {loading ? (
        <div className="loading">Loading products...</div>
      ) : (
        <div className="products-table-wrapper">
          <table className="products-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Price</th>
                <th>Offer Price</th>
                <th>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product._id}>
                  <td>
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="product-thumb" />
                    ) : (
                      <div className="no-image">No Image</div>
                    )}
                  </td>
                  <td>{product.name}</td>
                  <td>{product.category}</td>
                  <td>{product.brand || '-'}</td>
                  <td>₹{product.price}</td>
                  <td>{product.offerPrice ? `₹${product.offerPrice}` : '-'}</td>
                  <td>{product.stock || 0}</td>
                  <td>
                    <button onClick={() => handleEdit(product)} className="edit-btn">Edit</button>
                    <button onClick={() => handleDelete(product._id)} className="delete-btn">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ProductModal
          product={selectedProduct}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

export default Products;
