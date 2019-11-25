module.exports = {
    "extends": "airbnb-base",
    "rules": {
        "semi": [2, "never"],
        "indent": [2, "tab", {"SwitchCase": 1}],
        "no-tabs": 0,
        "no-console": 0,
        "no-restricted-syntax": 0,
        "max-len": ["error", { "code": 160 }],
        "arrow-parens": [2, "as-needed", { "requireForBlockBody": true }],
    }
}
