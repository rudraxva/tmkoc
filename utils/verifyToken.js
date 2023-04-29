require("dotenv").config(); // Load .env file
const jwt = require("jsonwebtoken");

// Middleware function to verify the JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res
      .status(401)
      .json({ error: "You are Unauthorized to do this operation." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error("Error verifying JWT token:", err);
      return res.status(403).json({ error: `Forbidden: ${err.message}` });
    }

    req.user = user;
    next();
  });
}
module.exports = authenticateToken;
