export const SAMPLE_PROJECT_DATA = {
  projectName: 'Sample E-commerce Site',
  files: [
    {
      name: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Awesome Gadgets</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <header>
        <h1>Awesome Gadgets</h1>
        <nav>
            <a href="pages/login.html" id="login-link">Login</a>
            <div class="cart-summary">
                Cart: <span id="cart-count">0</span> items
            </div>
        </nav>
    </header>
    <main>
        <h2>Our Products</h2>
        <div id="product-list" class="product-grid">
            <!-- Products will be injected by JavaScript -->
        </div>
    </main>
    <footer>
        <p>&copy; 2024 Awesome Gadgets Inc.</p>
    </footer>
    <script src="js/app.js"></script>
</body>
</html>`,
      language: 'html',
      isBinary: false,
      mimeType: 'text/html',
    },
    {
      name: 'pages/login.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Awesome Gadgets</title>
    <link rel="stylesheet" href="../css/style.css">
</head>
<body>
    <header>
        <h1>Login to Your Account</h1>
    </header>
    <main class="login-container">
        <form id="login-form">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" required>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit" class="btn">Log In</button>
            <p id="login-message" class="login-message"></p>
        </form>
    </main>
    <script src="../js/auth.js"></script>
</body>
</html>`,
      language: 'html',
      isBinary: false,
      mimeType: 'text/html',
    },
    {
      name: 'css/style.css',
      content: `body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background-color: #1f2937; /* gray-800 */
    color: #d1d5db; /* gray-300 */
    margin: 0;
    line-height: 1.6;
}

header {
    background-color: #111827; /* gray-900 */
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #374151; /* gray-700 */
}

header h1 {
    color: #e5e7eb; /* gray-200 */
    margin: 0;
}

nav a {
    color: #60a5fa; /* blue-400 */
    text-decoration: none;
    margin-left: 1rem;
}

main {
    padding: 2rem;
}

.product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1.5rem;
}

.product-card {
    background-color: #374151; /* gray-700 */
    border: 1px solid #4b5563; /* gray-600 */
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
}

.product-card h3 {
    margin-top: 0;
}

.btn {
    display: inline-block;
    background-color: #2563eb; /* blue-600 */
    color: white;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-decoration: none;
    transition: background-color 0.2s;
}

.btn:hover {
    background-color: #1d4ed8; /* blue-700 */
}

/* Login Page Styles */
.login-container {
    max-width: 400px;
    margin: 2rem auto;
    padding: 2rem;
    background-color: #374151;
    border-radius: 8px;
}

.form-group {
    margin-bottom: 1rem;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
}

.form-group input {
    width: 100%;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid #4b5563;
    background-color: #1f2937;
    color: white;
}

.login-message {
    margin-top: 1rem;
    text-align: center;
    color: #f87171; /* red-400 */
}
`,
      language: 'css',
      isBinary: false,
      mimeType: 'text/css',
    },
    {
      name: 'js/app.js',
      content: `const products = [
    { id: 1, name: 'Quantum Laptop', price: 1200 },
    { id: 2, name: 'Chrono Watch', price: 350 },
    { id: 3, name: 'Aero Drone', price: 800 },
    { id: 4, name: 'Echo Headphones', price: 150 },
];

let cart = [];

const renderProducts = () => {
    const productList = document.getElementById('product-list');
    if (!productList) return;

    productList.innerHTML = ''; // Clear existing products
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = \`
            <h3>\${product.name}</h3>
            <p>Price: $\${product.price}</p>
            <button class="btn add-to-cart" data-id="\${product.id}">Add to Cart</button>
        \`;
        productList.appendChild(card);
    });
};

const updateCartCount = () => {
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        cartCount.textContent = cart.length;
    }
};

const addToCart = (productId) => {
    const product = products.find(p => p.id === productId);
    if (product) {
        cart.push(product);
        console.log('Cart:', cart);
        updateCartCount();
    }
};

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    renderProducts();

    const productList = document.getElementById('product-list');
    productList.addEventListener('click', (event) => {
        if (event.target.classList.contains('add-to-cart')) {
            const productId = parseInt(event.target.dataset.id, 10);
            addToCart(productId);
        }
    });
});
`,
      language: 'javascript',
      isBinary: false,
      mimeType: 'text/javascript',
    },
     {
      name: 'js/auth.js',
      content: `document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginMessage = document.getElementById('login-message');

    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const username = event.target.elements.username.value;
            
            // Simulate login
            console.log(\`User '\${username}' attempted to log in.\`);

            if (username === 'admin') {
                loginMessage.textContent = 'Login successful! Redirecting...';
                loginMessage.style.color = '#4ade80'; // green-400
                
                // In a real app, you'd redirect. Here we just show a message.
                setTimeout(() => {
                    // window.location.href = '../index.html';
                    console.log('Redirect to homepage!');
                }, 1500);

            } else {
                loginMessage.textContent = 'Invalid username or password.';
                loginMessage.style.color = '#f87171'; // red-400
            }
        });
    }
});
`,
      language: 'javascript',
      isBinary: false,
      mimeType: 'text/javascript',
    },
    {
      name: 'README.md',
      content: `# Sample E-commerce Site

This project demonstrates a more complex setup within the MoText editor.

## File Structure

- \`index.html\`: The main storefront page. Lists products and shows a cart summary.
- \`pages/login.html\`: A separate login page.
- \`css/style.css\`: A single stylesheet for the entire site.
- \`js/app.js\`: Handles product rendering and cart logic for \`index.html\`.
- \`js/auth.js\`: Handles the simulated login form logic for \`login.html\`.
- \`tests/utils.test.js\`: A sample test file to demonstrate the new testing feature.

## Features

- **Dependency Analysis**: Run "Scan Project Flow" to see how the HTML, CSS, and JS files are linked.
- **Code Analysis**: Use the "Algo Explorer" panel on the JS files to see a heuristic breakdown of their structure.
- **Unit Testing**: Open the "Test" panel in the explorer to run the sample unit tests.
`,
      language: 'markdown',
      isBinary: false,
      mimeType: 'text/markdown',
    },
    {
      name: 'tests/.placeholder',
      content: '',
      language: 'placeholder',
      isBinary: true,
    },
    {
      name: 'tests/utils.test.js',
      content: `// This is a sample test file.
// You can write tests using describe, it, and expect.
// Open the 'Test' panel in the explorer and click 'Run Tests'.

const formatPrice = (price) => {
    if (typeof price !== 'number') {
        throw new Error('Price must be a number.');
    }
    return '$' + price.toFixed(2);
};

describe('formatPrice', () => {
    it('should format a positive number correctly', () => {
        const result = formatPrice(12.5);
        expect(result).toBe('$12.50');
    });

    it('should format zero correctly', () => {
        const result = formatPrice(0);
        expect(result).toBe('$0.00');
    });

    it('should handle integers', () => {
        const result = formatPrice(500);
        expect(result).toBe('$500.00');
    });
    
    it('should throw an error for non-number inputs', () => {
        expect(() => formatPrice('abc')).toThrow('Price must be a number.');
    });

    // This test is designed to fail to show how errors are reported.
    it('should fail gracefully', () => {
        const result = formatPrice(99);
        expect(result).toBe('$100.00');
    });
});
`,
      language: 'javascript',
      isBinary: false,
      mimeType: 'text/javascript',
    }
  ],
};
