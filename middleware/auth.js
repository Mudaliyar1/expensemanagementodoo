module.exports = {
  ensureAuthenticated: function(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    req.flash('error_msg', 'Please log in to view this resource');
    res.redirect('/users/login');
  },
  
  ensureAdmin: function(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 'Admin') {
      return next();
    }
    req.flash('error_msg', 'You do not have permission to view this resource');
    res.redirect('/dashboard');
  },
  
  ensureManager: function(req, res, next) {
    if (
      req.isAuthenticated() &&
      (['Manager', 'Admin', 'Financer', 'Director'].includes(req.user.role))
    ) {
      return next();
    }
    req.flash('error_msg', 'You do not have permission to view this resource');
    res.redirect('/dashboard');
  },
  
  ensureEmployee: function(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 'Employee') {
      return next();
    }
    req.flash('error_msg', 'Only employees can create expenses');
    res.redirect('/dashboard');
  }
};