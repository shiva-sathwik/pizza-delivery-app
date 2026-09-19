const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});

/**
 * @desc    Separate Admin Login Endpoint
 * @route   POST /api/admin/login
 * @access  Public (Restricted to Admin Credentials)
 */
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Admin email and password are required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check admin role
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have administrator permissions.'
      });
    }

    // Generate JWT with admin payload
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Set secure HTTP-only cookie
    res.cookie('token', token, getCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Admin authentication successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[AdminAuth] Admin login error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error during admin login.'
    });
  }
};

/**
 * @desc    Admin Authorization Test Endpoint
 * @route   GET /api/admin/test
 * @access  Private (Admin Role Only)
 */
const adminTest = (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Admin authorization test passed. You have verified admin privileges.',
    admin: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
};

module.exports = {
  adminLogin,
  adminTest
};
