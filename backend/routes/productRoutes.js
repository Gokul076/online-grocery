const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/productController');
const { auth, requireRole } = require('../middleware/auth');

router.get('/', ctrl.listProducts);
router.post('/', auth, requireRole('admin'), ctrl.createProduct);
router.put('/:id', auth, requireRole('admin'), ctrl.updateProduct);
router.patch('/:id/adjust-stock', auth, requireRole('admin'), ctrl.adjustStock);
router.delete('/:id', auth, requireRole('admin'), ctrl.deleteProduct);

module.exports = router;


