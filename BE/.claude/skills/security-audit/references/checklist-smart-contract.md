# Smart Contract Checklist (SWC-Registry Flavored)

Use when Stage 1 detects Solidity/Vyper contracts (`.sol`, `.vy`), a
Hardhat/Foundry/Truffle project, or similar. Findings here should note the
Solidity compiler version in scope, since several of these classes are
version-dependent (e.g. overflow checks are automatic since 0.8.0).

## A. Reentrancy (SWC-107)

- External calls (`.call{value:}`, `.transfer`, `.send`, or calling another
  contract) made _before_ the calling contract updates its own state
  (checks-effects-interactions violated). Classic path: withdraw function
  sends funds then zeroes the balance, instead of zeroing first.
- Cross-function reentrancy: two functions share state, and reentering a
  _different_ function than the one initially called still lets the
  attacker exploit stale state.
- Read-only reentrancy: a view function returns a manipulable value during
  a reentrant call, and another protocol integrating with this contract
  trusts that view function mid-transaction.

## B. Access Control (SWC-105, SWC-106)

- Missing or incorrect `onlyOwner`/role modifiers on privileged functions
  (minting, withdrawing funds, upgrading, pausing, changing critical
  addresses).
- `tx.origin` used for authorization instead of `msg.sender` (phishable via
  a malicious contract the victim interacts with).
- Uninitialized/unprotected `initialize()` in upgradeable (proxy) contracts
  — anyone can call it and become the owner if it's not access-controlled
  or already initialized.

## C. Arithmetic (SWC-101)

- Solidity <0.8.0: unchecked overflow/underflow — verify a SafeMath-style
  library is used consistently. Solidity ≥0.8.0: overflow reverts by
  default, but check for `unchecked { }` blocks that reintroduce the risk.
- Precision loss / rounding direction that favors the attacker in
  division-before-multiplication patterns, especially in share/price
  calculations for vaults and AMMs.

## D. Unchecked External Calls & Delegatecall (SWC-104, SWC-112)

- Low-level `.call()` return value not checked — a failed transfer can
  silently succeed from the caller's perspective.
- `delegatecall` to an address that's user-controlled or comes from
  untrusted input — this executes arbitrary code in the calling contract's
  storage context.

## E. Oracle & Price Manipulation

- Spot price read directly from a single DEX pool's reserves
  (`getReserves()`-style) instead of a time-weighted average (TWAP) or a
  decentralized oracle (Chainlink) — flash-loan-manipulable within a single
  transaction.
- Oracle staleness not checked (using a Chainlink price without validating
  `updatedAt` is recent).

## F. Front-Running / MEV (SWC-114)

- Functions where the outcome depends on transaction ordering in a way
  that's exploitable (e.g. approve-then-transferFrom race, commit-reveal
  missing where it should exist for sensitive actions like auctions).

## G. Denial of Service (SWC-113, SWC-128)

- Unbounded loops over arrays that can grow via user action (e.g. iterating
  over all depositors to distribute rewards) — an attacker can grow the
  array to make the function run out of gas for everyone.
- A single failing external call in a loop blocking the whole batch
  (should isolate failures, e.g. via try/catch or pull-over-push payment
  patterns).

## H. Randomness (SWC-120)

- On-chain "randomness" derived from `block.timestamp`, `block.difficulty`
  / `block.prevrandao`, or `blockhash` for anything of value — miners/
  validators can influence or predict these.

## I. Token-Specific (ERC-20/721/1155)

- Non-standard token behavior not accounted for: tokens that take a fee on
  transfer (received amount ≠ sent amount), tokens that return `false`
  instead of reverting on failure, tokens with callback hooks (ERC-777/
  ERC-1155) enabling reentrancy through the token itself.

---

Cite the SWC ID (e.g. "SWC-107: Reentrancy") in `citations`. If the project
has an existing audit report from a prior firm, note in Stage 1/2 whether
findings here overlap with already-known/accepted issues rather than
re-flagging them as new.
