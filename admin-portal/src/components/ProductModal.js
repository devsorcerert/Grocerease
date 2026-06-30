import React, { useState, useEffect } from 'react';
import { createProduct, updateProduct, getCategories } from '../services/products';
import '../styles/ProductModal.css';

const ProductModal = ({ product, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    brand: '',
    price: '',
    offerPrice: '',
    stock: '',
    description: '',
    image: '',
    is_featured: false,
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCategories();
    if (product) {
      setFormData({
        name: product.name || '',
        category: product.category || '',
        brand: product.brand || '',
        price: product.price || '',
        offerPrice: product.offerPrice || '',
        stock: product.stock || '',
        description: product.description || '',
        image: product.image || '',
        is_featured: product.is_featured || false,
      });
    }
  }, [product]);

  const loadCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (product) {
        await updateProduct(product.id, formData);
      } else {
        await createProduct(formData);
      }
      onClose(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{product ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={() => onClose(false)} className="close-btn">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="product-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>Product Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Category *</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Brand</label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Stock *</label>
              <input
                type="number"
                name="stock"
                value={formData.stock}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                name="price"
                value={formData.price}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Offer Price (₹)</label>
              <input
                type="number"
                step="0.01"
                name="offerPrice"
                value={formData.offerPrice}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
            />
          </div>

          <div className="form-group">
            <label>Image URL</label>
            <input
              type="text"
              name="image"
              value={formData.image}
              onChange={handleChange}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="modal-footer">
            <button type="button" onClick={() => onClose(false)} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;
