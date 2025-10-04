const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');

// Models
const User = require('../models/User');
const Company = require('../models/Company');
const ApprovalWorkflow = require('../models/ApprovalWorkflow');

// Auth middleware
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');

// Login Page
router.get('/login', (req, res) => res.render('users/login'));

// Register Page
router.get('/register', (req, res) => res.render('users/register'));

// Register Handle
router.post('/register', async (req, res) => {
  const { name, email, password, password2, country } = req.body;
  let errors = [];

  // Check required fields
  if (!name || !email || !password || !password2 || !country) {
    errors.push({ msg: 'Please fill in all fields' });
  }

  // Check passwords match
  if (password !== password2) {
    errors.push({ msg: 'Passwords do not match' });
  }

  // Check password length
  if (password.length < 6) {
    errors.push({ msg: 'Password should be at least 6 characters' });
  }

  if (errors.length > 0) {
    res.render('users/register', {
      errors,
      name,
      email,
      country
    });
  } else {
    try {
      // Check if user exists
      const existingUser = await User.findOne({ email });
      
      if (existingUser) {
        errors.push({ msg: 'Email is already registered' });
        return res.render('users/register', {
          errors,
          name,
          email,
          country
        });
      }

      // Create new company and user
      const company = new Company({
        name: name + "'s Company",
        country,
        defaultCurrency: getCurrencyByCountry(country)
      });
      
      await company.save();

      // Create default approval workflow
      const workflow = new ApprovalWorkflow({
        name: 'Default Workflow',
        company: company._id,
        includeManagerApproval: true,
        steps: [
          {
            stepNumber: 1,
            approvers: [],
            requiredApprovalPercentage: 100
          }
        ]
      });
      
      await workflow.save();

      // Hash Password
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      
      // Check if this is the first user in the system
      const userCount = await User.countDocuments();
      
      // Create new user
      const newUser = new User({
        name,
        email,
        password: hash,
        role: userCount === 0 ? 'Admin' : 'Employee', // Only first user is admin
        company: company._id
      });
      
      await newUser.save();
      
      req.flash('success_msg', 'You are now registered and can log in');
      res.redirect('/users/login');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'An error occurred during registration');
      res.redirect('/users/register');
    }
  }
});

// Login Handle
router.post('/login', (req, res, next) => {
  // Save email to pass back in case of failure
  const { email, password } = req.body;
  
  // Validate required fields
  if (!email || !password) {
    return res.render('users/login', {
      error_msg: 'Please enter both email and password',
      email: email
    });
  }
  
  passport.authenticate('local', (err, user, info) => {
    if (err) { return next(err); }
    if (!user) {
      // Pass the email back to the form
      return res.render('users/login', { 
        error_msg: info.message,
        email: email
      });
    }
    req.logIn(user, (err) => {
      if (err) { return next(err); }
      // Check if user is active
      if (!user.isActive) {
        req.logout(function(err) {
          if (err) { return next(err); }
          return res.render('users/login', {
            error_msg: 'Your account has been deactivated. Please contact an administrator.',
            email: email
          });
        });
      } else {
        return res.redirect('/dashboard');
      }
    });
  })(req, res, next);
});

// Logout Handle
router.get('/logout', (req, res) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    req.flash('success_msg', 'You are logged out');
    res.redirect('/users/login');
  });
});

// Admin: User Management
router.get('/manage', ensureAdmin, async (req, res) => {
  try {
    const users = await User.find({ company: req.user.company }).populate('manager');
    const managers = await User.find({ company: req.user.company, role: 'Manager' });
    
    res.render('users/manage', {
      users,
      managers
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error retrieving users');
    res.redirect('/dashboard');
  }
});

// Admin: Create User
router.post('/create', ensureAdmin, async (req, res) => {
  const { name, email, role, manager: managerId, password } = req.body;
  let errors = [];

  try {
    // Check if user exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      req.flash('error_msg', 'Email is already registered');
      return res.redirect('/users/manage');
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    // Create new user
    const newUser = new User({
      name,
      email,
      password: hash,
      role,
      company: req.user.company,
      manager: role === 'Employee' && managerId ? managerId : null
    });
    
    await newUser.save();
    
    req.flash('success_msg', `User created successfully. Temporary password: ${password}`);
    res.redirect('/users/manage');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error creating user');
    res.redirect('/users/manage');
  }
});

// Admin: Update User
router.put('/update/:id', ensureAdmin, async (req, res) => {
  try {
    const { name, email, role, managerId, isActive } = req.body;
    
    const updateData = {
      name,
      email,
      role,
      isActive: isActive === 'on',
      manager: role === 'Employee' && managerId ? managerId : null
    };
    
    await User.findByIdAndUpdate(req.params.id, updateData);
    
    req.flash('success_msg', 'User updated successfully');
    res.redirect('/users/manage');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error updating user');
    res.redirect('/users/manage');
  }
});

// Admin: Delete User
router.delete('/delete/:id', ensureAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    
    req.flash('success_msg', 'User deleted successfully');
    res.redirect('/users/manage');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error deleting user');
    res.redirect('/users/manage');
  }
});

// Helper function to get currency by country
function getCurrencyByCountry(country) {
  const currencyMap = {
    'United States': 'USD',
    'United Kingdom': 'GBP',
    'European Union': 'EUR',
    'Japan': 'JPY',
    'Canada': 'CAD',
    'Australia': 'AUD',
    'Switzerland': 'CHF',
    'China': 'CNY',
    'India': 'INR',
    // Add more countries as needed
  };
  
  return currencyMap[country] || 'USD';
}

module.exports = router;