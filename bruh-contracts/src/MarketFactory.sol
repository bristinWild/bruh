// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step}    from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable}         from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {Market}          from "./Market.sol";

/// @title  MarketFactory
/// @author Bruh Protocol
/// @notice Deploys and tracks all Bruh prediction markets.
///
/// ┌─────────────────────────────────────────────────────────────────────────┐
/// │  DESIGN                                                                 │
/// │                                                                         │
/// │  · Two-step ownership (Ownable2Step) prevents accidental renounce      │
/// │  · Owner controls: oracle, treasury, fee, pause, creation whitelist    │
/// │  · Anyone can create a market if creation is open (default: open)      │
/// │  · Factory seeds initial liquidity from creator's USDC balance         │
/// │  · All markets indexed on-chain for enumeration                        │
/// │  · Emergency: factory owner can pause all markets at once              │
/// └─────────────────────────────────────────────────────────────────────────┘

contract MarketFactory is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Constants

    /// @notice Minimum seed liquidity per market (10 USDC)
    uint256 public constant MIN_SEED = 10e6;

    /// @notice Maximum seed liquidity per market (100,000 USDC)
    uint256 public constant MAX_SEED = 100_000e6;

    /// @notice Minimum market duration (1 hour)
    uint256 public constant MIN_DURATION = 1 hours;

    /// @notice Maximum market duration (365 days)
    uint256 public constant MAX_DURATION = 365 days;

    // State

    /// @notice USDC token on Arc
    IERC20 public immutable usdc;

    /// @notice Default oracle for new markets (can be overridden per-market)
    address public defaultOracle;

    /// @notice Protocol fee treasury
    address public treasury;

    /// @notice Default fee in basis points for new markets
    uint256 public defaultFeeBps;

    /// @notice If true, only whitelisted addresses can create markets
    bool public creationWhitelisted;

    /// @notice Addresses permitted to create markets (when whitelist is on)
    mapping(address => bool) public creators;

    /// @notice All deployed market addresses (index → address)
    address[] public markets;

    /// @notice Reverse lookup: market address → index + 1 (0 = not a market)
    mapping(address => uint256) public marketIndex;

    /// @notice Markets created by a given address
    mapping(address => address[]) public marketsByCreator;

   
    // Events

    event MarketCreated(
        address indexed market,
        address indexed creator,
        address indexed oracle,
        string  question,
        uint256 closeTime,
        uint256 seedUsdc,
        uint256 marketId
    );

    event DefaultOracleUpdated(address indexed oldOracle, address indexed newOracle);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event DefaultFeeUpdated(uint256 oldBps, uint256 newBps);
    event CreatorWhitelisted(address indexed creator, bool allowed);
    event CreationWhitelistToggled(bool enabled);
    event MarketPausedByFactory(address indexed market);
    event MarketUnpausedByFactory(address indexed market);
    event OracleRotated(address indexed market, address indexed newOracle);

    // Errors

    error InvalidAddress();
    error InvalidQuestion();
    error DurationTooShort();
    error DurationTooLong();
    error SeedBelowMinimum();
    error SeedAboveMaximum();
    error NotWhitelisted();
    error NotAMarket();
    error InvalidFee();

    
    // Constructor

    /// @param _usdc           USDC token on Arc
    /// @param _defaultOracle  Initial default oracle (agent wallet)
    /// @param _treasury       Protocol fee recipient
    /// @param _owner          Factory owner (protocol multisig)
    constructor(
        address _usdc,
        address _defaultOracle,
        address _treasury,
        address _owner
    ) Ownable(_owner) {
        if (_usdc           == address(0)) revert InvalidAddress();
        if (_defaultOracle  == address(0)) revert InvalidAddress();
        if (_treasury       == address(0)) revert InvalidAddress();

        usdc           = IERC20(_usdc);
        defaultOracle  = _defaultOracle;
        treasury       = _treasury;
        defaultFeeBps  = 100; // 1% default
    }

    // Market Creation


    /// @notice Deploy a new binary prediction market.
    ///
    /// @param  question   The prediction question (non-empty string)
    /// @param  closeTime  Unix timestamp when trading closes
    /// @param  seedUsdc   Initial liquidity in USDC (caller must approve factory)
    /// @param  oracle     Oracle for this market (address(0) = use defaultOracle)
    /// @return market     Address of the deployed Market contract
    function createMarket(
        string calldata question,
        uint256         closeTime,
        uint256         seedUsdc,
        address         oracle
    )
        external
        nonReentrant
        whenNotPaused
        returns (address market)
    {
        //  Access control 
        if (creationWhitelisted && !creators[msg.sender]) revert NotWhitelisted();

        //  Input validation 
        if (bytes(question).length == 0) revert InvalidQuestion();

        uint256 duration = closeTime - block.timestamp;
        if (duration < MIN_DURATION) revert DurationTooShort();
        if (duration > MAX_DURATION) revert DurationTooLong();

        if (seedUsdc < MIN_SEED) revert SeedBelowMinimum();
        if (seedUsdc > MAX_SEED) revert SeedAboveMaximum();

        address resolverOracle = oracle == address(0) ? defaultOracle : oracle;
        if (resolverOracle == address(0)) revert InvalidAddress();

        //  Pull seed liquidity from creator 
        usdc.safeTransferFrom(msg.sender, address(this), seedUsdc);

        //  Deploy market 
        market = address(new Market(
            address(usdc),
            resolverOracle,
            treasury,
            msg.sender,
            question,
            closeTime,
            seedUsdc
        ));

        //  Fund market with seed USDC 
        usdc.safeTransfer(market, seedUsdc);

        //  Index 
        uint256 id = markets.length;
        markets.push(market);
        marketIndex[market] = id + 1; // +1 so 0 = "not a market"
        marketsByCreator[msg.sender].push(market);

        emit MarketCreated(
            market,
            msg.sender,
            resolverOracle,
            question,
            closeTime,
            seedUsdc,
            id
        );
    }

    
    // Market Admin (owner → specific market)
    /// @notice Rotate the oracle for a specific market.
    function rotateOracle(address market, address newOracle) external onlyOwner {
        _assertMarket(market);
        if (newOracle == address(0)) revert InvalidAddress();
        Market(market).rotateOracle(newOracle);
        emit OracleRotated(market, newOracle);
    }

    /// @notice Emergency pause a specific market.
    function pauseMarket(address market) external onlyOwner {
        _assertMarket(market);
        Market(market).pause();
        emit MarketPausedByFactory(market);
    }

    /// @notice Unpause a specific market.
    function unpauseMarket(address market) external onlyOwner {
        _assertMarket(market);
        Market(market).unpause();
        emit MarketUnpausedByFactory(market);
    }

    /// @notice Update fee for a specific market.
    function setMarketFee(address market, uint256 newBps) external onlyOwner {
        _assertMarket(market);
        Market(market).setFee(newBps);
    }

    
    // Global Admin (owner → factory settings)
    

    /// @notice Set the default oracle for newly created markets.
    function setDefaultOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert InvalidAddress();
        emit DefaultOracleUpdated(defaultOracle, newOracle);
        defaultOracle = newOracle;
    }

    /// @notice Update protocol fee treasury.
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    /// @notice Update default fee for newly created markets.
    function setDefaultFee(uint256 newBps) external onlyOwner {
        if (newBps > 500) revert InvalidFee();
        emit DefaultFeeUpdated(defaultFeeBps, newBps);
        defaultFeeBps = newBps;
    }

    /// @notice Toggle creation whitelist on/off.
    function setCreationWhitelisted(bool enabled) external onlyOwner {
        creationWhitelisted = enabled;
        emit CreationWhitelistToggled(enabled);
    }

    /// @notice Add or remove a creator from the whitelist.
    function setCreator(address creator, bool allowed) external onlyOwner {
        if (creator == address(0)) revert InvalidAddress();
        creators[creator] = allowed;
        emit CreatorWhitelisted(creator, allowed);
    }

    /// @notice Pause factory (prevents new market creation).
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause factory.
    function unpause() external onlyOwner {
        _unpause();
    }

    // Views

    /// @notice Total number of markets deployed.
    function marketCount() external view returns (uint256) {
        return markets.length;
    }

    /// @notice Paginated market list.
    /// @param  offset  Start index
    /// @param  limit   Max results (capped at 100)
    function getMarkets(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory result)
    {
        uint256 total = markets.length;
        if (offset >= total) return new address[](0);

        uint256 cap  = limit > 100 ? 100 : limit;
        uint256 size = total - offset;
        if (size > cap) size = cap;

        result = new address[](size);
        for (uint256 i; i < size; ++i) {
            result[i] = markets[offset + i];
        }
    }

    /// @notice Markets created by a given address.
    function getMarketsByCreator(address creator)
        external
        view
        returns (address[] memory)
    {
        return marketsByCreator[creator];
    }

    /// @notice Returns true if `addr` is a market deployed by this factory.
    function isMarket(address addr) external view returns (bool) {
        return marketIndex[addr] != 0;
    }

    // Internal

    function _assertMarket(address market) internal view {
        if (marketIndex[market] == 0) revert NotAMarket();
    }
}
