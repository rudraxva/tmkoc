const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("./db/config");
const multer = require("multer");
const bcrypt = require("bcrypt");
require("dotenv").config(); // Load .env file
const saltRounds = 10;
const User = require("./db/User");
const authenticateToken = require("./utils/verifyToken");
const Products = require("./db/Products");


const app = express();
app.use("/uploads", express.static(__dirname+'/uploads'));
app.use(express.json());
app.use(cors());

const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "uploads");
    },
    filename: function (req, file, cb) {
      cb(null, file.fieldname + "_" + Date.now() + ".jpg");
    },
  }),
}).single("product_image");

app.post("/register", async (req, res) => {
  if (req.body.password && req.body.email && req.body.name) {
    User.findOne({ email: req.body.email })
      .then(async (userExist) => {
        if (userExist) {
          res.status(409).send({ error: "User already exists" });
        } else {
          const token = jwt.sign(
            { email: req.body.email, name: req.body.name },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
          );
          bcrypt.genSalt(saltRounds, (err, salt) => {
            if (err) {
              console.error(err);
            } else {
              // hash the password with the salt
              bcrypt.hash(req.body.password, salt, async (err, hash) => {
                if (err) {
                  console.error("error in encryption", err);
                } else {
                  // store the hash in the database
                  let user = new User({
                    name: req.body.name,
                    password: hash,
                    email: req.body.email,
                  });
                  let result = await user.save();
                  res.send({ ...result._doc, token });
                }
              });
            }
          });
        }
      })
      .catch((err) => console.error("Error searching for user:", err));
  } else {
    res.send({ error: "please add all details" });
  }
});

app.post("/login", async (req, res) => {
  if (req.body.password && req.body.email) {
    let user = await User.findOne({ email: req.body.email });
    if (user) {
      bcrypt.compare(req.body.password, user.password, (err, result) => {
        if (err) {
          console.error("error occurred while decryption.", err);
        } else if (result === true) {
          const token = jwt.sign(
            { account: req.body, userId: user._id },
            process.env.JWT_SECRET,
            {
              expiresIn: "1h",
            }
          );
          let finalUser = {
            name: user.name,
            email: user.email,
            userId: user._id
          };
          res.send({ ...finalUser, token });
          console.log("Authentication successful");
        } else {
          res.status(404).send({ error: "incorrect password" });
        }
      });
    } else {
      res.status(404).send({ error: "No user found!" });
    }
  } else {
    res.status(404).send({ error: "Please provide all the data." });
  }
});
;
app.post("/add-product", upload, authenticateToken, async (req, res) => {
  if (req.body.name) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    let userData = jwt.decode(token, (verify = false));
    const filename = req.file.filename;
    const basePath = `${req.protocol}://${req.get("host")}/uploads/`;
    try {
      let product = new Products({
        ...req.body,
        userId: userData.userId,
        imageLink: `${basePath}${filename}`,
      });
      let result = await product.save();
      res.send(result);
    } catch (e) {
      res.send({ error: "something went wrong with DB" });
    }
  } else {
    res.send({ error: "provide required data" });
  }
});

app.get("/products", authenticateToken, async (req, res) => {
  const products = await Products.find();
  if (products.length > 0) {
    res.send(products);
  } else {
    res.status(404).send({ error: "No Products Found!" });
  }
});

app.get("/categories", authenticateToken, async (req, res) => {
  try {
    const categories = await Products.distinct("category");
    res.send(categories);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/product/:id", authenticateToken, async (req, res) => {
  try {
    const products = await Products.findOne({ _id: req.params.id });
    if (products) {
      res.send(products);
    } else {
      res.send({ result: "No Products Found!" });
    }
  } catch {
    res.send({ error: "No Products Found!" });
  }
});

app.delete("/product/:id", authenticateToken, async (req, resp) => {
  let res = await Products.deleteOne({ _id: req.params.id });
  resp.send(res);
});

app.put("/product/:id", authenticateToken, async (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  let userData = jwt.decode(token, (verify = false));
  try {
    let productDetails = await Products.findOne({ _id: req.params.id });
    if (productDetails?.userId === userData?.userId) {
      const result = await Products.updateOne(
        {
          _id: req.params.id,
        },
        { $set: req.body }
      );
      res.send(result);
    } else {
      res.status(404).send({ error: "Not Authorized" });
    }
  } catch (error) {
    res.send({ error: "Product id not found!" });
  }
});

app.get("/search/:key", authenticateToken, async (req, res) => {
  try {
    const results = await Products.find({
      $or: [
        { name: { $regex: req.params.key, $options: "i" } },
        { category: { $regex: req.params.key, $options: "i" } },
        { company: { $regex: req.params.key, $options: "i" } },
      ],
    });
    if (results.length > 0) {
      res.send(results);
    } else {
      res.send("No product Found!");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(8000);
