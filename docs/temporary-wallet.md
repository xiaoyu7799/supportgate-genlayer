# Temporary Studionet wallet

The wallet chooser offers an optional disposable EIP-1193 signer for Stable Studionet. It generates a real secp256k1 account in the browser, obtains 1 test GEN from the official Studio `sim_fundAccount` faucet, and verifies the actual credited balance. No mainnet endpoint or assets are used.

The account starts without a registered network. The normal application connection flow adds Stable Studionet, switches to chain 61999 and requests the account through the provider. Application writes still go through `signingClient(provider, account)` and `eth_sendTransaction`; the provider signs the exact EVM transaction, recovers the signer address as a check, and broadcasts the serialized signature through `eth_sendRawTransaction`. The application polls real RPC responses and reads finalized contract state exactly as it does for an injected wallet.

The signer permits only chain 61999, zero-value calls and the configured GenLayer consensus contract. It has no key export or browser-storage persistence. The private signing account stays in a closure in the current tab’s memory. Reloading, closing the tab or selecting **Destroy temporary wallet** discards the signing account. Destroying it also clears provider listeners and removes it from the wallet chooser. Unspent faucet GEN becomes inaccessible after disposal; it has no cash value.

The transaction export includes public wallet proof: faucet balance observation, requested provider methods, serialized signed transactions and recovered signer addresses. Serialized signatures are public transaction evidence, not private keys. Destroying the wallet downloads a public cleanup record. Save needed receipts before disposing of a test account.

This adapter exercises the production EIP-1193 connection and signing path. It does not certify the user interfaces or behaviors of a particular third-party extension such as MetaMask, OKX, Rabby or Coinbase Wallet. Those remain available through EIP-6963 and legacy injected discovery.
