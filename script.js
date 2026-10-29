
const screen = document.getElementById("screen");
const expressionDisplay = document.getElementById("expression");
const message = document.getElementById("message");
const historyList = document.getElementById("historyList");
const themeBtn = document.getElementById("themeBtn");

let expression = "";
let justCalculated = false;
let history = [];

function showMessage(text, error = false) {
  message.textContent = text;
  message.classList.toggle("error", error);
}

function updateScreen() {
  expressionDisplay.textContent = expression;
  screen.value = expression || "0";
}

function insertValue(value) {
  if (justCalculated) {
    if (/^[0-9.]$/.test(value) || value === "pi" ||
        value.endsWith("(")) {
      expression = "";
    }
    justCalculated = false;
  }

  expression += value;
  updateScreen();
  showMessage("Ready to calculate");
}

function clearCalculator() {
  expression = "";
  justCalculated = false;
  updateScreen();
  showMessage("Cleared");
}

function backspace() {
  if (justCalculated) {
    expression = "";
    justCalculated = false;
  } else {
    expression = expression.slice(0, -1);
  }

  updateScreen();
  showMessage("Ready to calculate");
}

function toggleSign() {
  if (!expression) {
    expression = "-";
  } else {
    expression = `-(${expression})`;
  }

  justCalculated = false;
  updateScreen();
}

function tokenize(input) {
  const tokens = [];
  const pattern =
    /\s*((?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|[a-zA-Z]+|[()+\-*/^%])/iy;

  let position = 0;

  while (position < input.length) {
    pattern.lastIndex = position;
    const match = pattern.exec(input);

    if (!match) {
      throw new Error("Invalid expression");
    }

    tokens.push(match[1]);
    position = pattern.lastIndex;
  }

  return tokens;
}

function evaluate(input) {
  const tokens = tokenize(input);
  let index = 0;

  function peek() {
    return tokens[index];
  }

  function consume(expected) {
    const token = tokens[index];

    if (expected !== undefined && token !== expected) {
      throw new Error("Check your brackets or expression");
    }

    index++;
    return token;
  }

  function parseExpression() {
    let value = parseTerm();

    while (peek() === "+" || peek() === "-") {
      const operator = consume();
      const right = parseTerm();

      value = operator === "+" ? value + right : value - right;
    }

    return value;
  }

  function parseTerm() {
    let value = parseUnary();

    while (peek() === "*" || peek() === "/") {
      const operator = consume();
      const right = parseUnary();

      if (operator === "/" && right === 0) {
        throw new Error("Cannot divide by zero");
      }

      value = operator === "*" ? value * right : value / right;
    }

    return value;
  }

  function parseUnary() {
    if (peek() === "+") {
      consume("+");
      return parseUnary();
    }

    if (peek() === "-") {
      consume("-");
      return -parseUnary();
    }

    return parsePower();
  }

  function parsePower() {
    const base = parsePostfix();

    if (peek() === "^") {
      consume("^");
      return Math.pow(base, parseUnary());
    }

    return base;
  }

  function parsePostfix() {
    let value = parsePrimary();

    while (peek() === "%") {
      consume("%");
      value /= 100;
    }

    return value;
  }

  function parsePrimary() {
    const token = peek();

    if (token === "(") {
      consume("(");
      const value = parseExpression();
      consume(")");
      return value;
    }

    if (token && /^\d/.test(token) || token && /^\.\d/.test(token)) {
      consume();
      return Number(token);
    }

    if (token && /^[a-zA-Z]+$/.test(token)) {
      const name = consume().toLowerCase();

      if (name === "pi") return Math.PI;
      if (name === "e") return Math.E;

      const functions = {
        sqrt: x => {
          if (x < 0) throw new Error("Square root needs a non-negative number");
          return Math.sqrt(x);
        },
        log: x => {
          if (x <= 0) throw new Error("Log needs a positive number");
          return Math.log10(x);
        },
        ln: x => {
          if (x <= 0) throw new Error("Ln needs a positive number");
          return Math.log(x);
        },
        sin: x => Math.sin(x * Math.PI / 180),
        cos: x => Math.cos(x * Math.PI / 180),
        tan: x => {
          const radians = x * Math.PI / 180;
          if (Math.abs(Math.cos(radians)) < 1e-12) {
            throw new Error("Tangent is undefined here");
          }
          return Math.tan(radians);
        }
      };

      if (!functions[name]) {
        throw new Error("Unknown function");
      }

      consume("(");
      const argument = parseExpression();
      consume(")");

      return functions[name](argument);
    }

    throw new Error("Enter a valid calculation");
  }

  if (!tokens.length) {
    throw new Error("Enter a calculation first");
  }

  const result = parseExpression();

  if (index !== tokens.length) {
    throw new Error("Check your expression");
  }

  if (!Number.isFinite(result)) {
    throw new Error("Invalid result");
  }

  return result;
}

function formatNumber(number) {
  if (Object.is(number, -0)) return "0";

  if (Math.abs(number) >= 1e15 ||
      (Math.abs(number) > 0 && Math.abs(number) < 1e-9)) {
    return number.toExponential(8);
  }

  return Number(number.toPrecision(12)).toString();
}

function renderHistory() {
  historyList.replaceChildren();

  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Your calculations will appear here.";
    historyList.appendChild(empty);
    return;
  }

  history.forEach(item => {
    const row = document.createElement("div");
    row.className = "history-item";

    const equation = document.createElement("button");
    equation.textContent = item.expression;
    equation.title = "Click to reuse this expression";

    equation.addEventListener("click", () => {
      expression = item.expression;
      justCalculated = false;
      updateScreen();
      showMessage("Calculation restored");
    });

    const result = document.createElement("strong");
    result.textContent = item.result;

    row.append(equation, result);
    historyList.appendChild(row);
  });
}

function saveHistory(original, result) {
  history.unshift({
    expression: original,
    result: formatNumber(result)
  });

  history = history.slice(0, 20);

  try {
    localStorage.setItem("calculatorHistory", JSON.stringify(history));
  } catch (_) {}

  renderHistory();
}

function calculate() {
  try {
    const original = expression;
    const result = evaluate(original);

    expression = formatNumber(result);
    justCalculated = true;

    expressionDisplay.textContent = original + " =";
    screen.value = expression;

    showMessage("Calculation successful");
    saveHistory(original, result);
  } catch (error) {
    showMessage(error.message || "Invalid calculation", true);
  }
}

document.querySelector(".keypad").addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.action;
  const value = button.dataset.value;

  if (action === "clear") clearCalculator();
  else if (action === "backspace") backspace();
  else if (action === "calculate") calculate();
  else if (action === "sign") toggleSign();
  else if (value) insertValue(value);
});

document.querySelector(".scientific-keys").addEventListener("click", event => {
  const button = event.target.closest("button");
  if (button && button.dataset.value) {
    insertValue(button.dataset.value);
  }
});

document.addEventListener("keydown", event => {
  if (event.ctrlKey || event.altKey || event.metaKey) return;

  const key = event.key;

  if (/^[0-9.]$/.test(key) ||
      ["+", "-", "*", "/", "^", "%", "(", ")"].includes(key)) {
    event.preventDefault();
    insertValue(key);
  } else if (key === "Enter" || key === "=") {
    event.preventDefault();
    calculate();
  } else if (key === "Backspace") {
    event.preventDefault();
    backspace();
  } else if (key === "Escape" || key === "Delete") {
    event.preventDefault();
    clearCalculator();
  }
});

function setTheme(dark) {
  document.body.classList.toggle("dark", dark);
  themeBtn.textContent = dark ? "☀️" : "🌙";

  try {
    localStorage.setItem("calculatorTheme", dark ? "dark" : "light");
  } catch (_) {}
}

themeBtn.addEventListener("click", () => {
  setTheme(!document.body.classList.contains("dark"));
});

document.getElementById("clearHistory").addEventListener("click", () => {
  history = [];

  try {
    localStorage.removeItem("calculatorHistory");
  } catch (_) {}

  renderHistory();
  showMessage("History cleared");
});

try {
  const savedHistory = JSON.parse(
    localStorage.getItem("calculatorHistory") || "[]"
  );

  if (Array.isArray(savedHistory)) {
    history = savedHistory
      .filter(item =>
        item &&
        typeof item.expression === "string" &&
        typeof item.result === "string"
      )
      .slice(0, 20);
  }

  setTheme(localStorage.getItem("calculatorTheme") === "dark");
} catch (_) {
  setTheme(false);
}

updateScreen();
renderHistory();
