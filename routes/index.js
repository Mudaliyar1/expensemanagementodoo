const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');

// Welcome Page
router.get('/', (req, res) => res.render('welcome'));

// Dashboard based on user role
router.get('/dashboard', ensureAuthenticated, (req, res) => {
  switch(req.user.role) {
    case 'Admin':
      res.redirect('/admin/dashboard');
      break;
    case 'Manager':
      res.redirect('/approvals/dashboard');
      break;
    case 'Employee':
      res.redirect('/expenses/dashboard');
      break;
    default:
      res.redirect('/');
  }
});

module.exports = router;