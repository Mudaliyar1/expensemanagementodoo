
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
router.get('/login', (req, res) => {
  res.render('users/login');
});

// Forgot Password - Request OTP
router.get('/forgot-password', (req, res) => {
  res.render('users/forgot-password');
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.render('users/forgot-password', { error_msg: 'Please enter your email.' });
  }
  const user = await User.findOne({ email });
  if (!user) {
    return res.render('users/forgot-password', { error_msg: 'No account found with that email.' });
  }
  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.resetOtp = otp;
  user.resetOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save();
  // Send OTP email
  const { sendOtpEmail } = require('../utils/emailSender');
  await sendOtpEmail(email, otp);
  res.render('users/enter-otp', { email });
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.render('users/enter-otp', { email, error_msg: 'Please enter the OTP.' });
  }
  const user = await User.findOne({ email });
  if (!user || !user.resetOtp || !user.resetOtpExpires) {
    return res.render('users/enter-otp', { email, error_msg: 'Invalid or expired OTP.' });
  }
  if (user.resetOtp !== otp || user.resetOtpExpires < Date.now()) {
    return res.render('users/enter-otp', { email, error_msg: 'Invalid or expired OTP.' });
  }
  // OTP verified, show reset password form
  res.render('users/reset-password', { email });
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.render('users/reset-password', { email, error_msg: 'Please enter a new password.' });
  }
  const user = await User.findOne({ email });
  if (!user) {
    return res.render('users/reset-password', { email, error_msg: 'User not found.' });
  }
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(password, salt);
  user.resetOtp = null;
  user.resetOtpExpires = null;
  await user.save();
  req.flash('success_msg', 'Password reset successful. You can now log in.');
  res.redirect('/users/login');
});

// Profile Page
router.get('/profile', ensureAuthenticated, async (req, res) => {
  try {
    // Populate company for display
    const user = await User.findById(req.user._id).populate('company');
    res.render('users/profile', { user });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading profile');
    res.redirect('/dashboard');
  }
});
// Login Handle
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

    // Send credentials email to new user
    const { sendUserCredentialsEmail } = require('../utils/emailSender');
    try {
      await sendUserCredentialsEmail({
        to: email,
        name,
        password,
        role,
        company: req.user.company
      });
      req.flash('success_msg', `User created successfully. Credentials sent to ${email}`);
    } catch (emailErr) {
      console.error('Error sending credentials email:', emailErr);
      req.flash('success_msg', `User created successfully, but failed to send email. Temporary password: ${password}`);
    }
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
module.exports = router;