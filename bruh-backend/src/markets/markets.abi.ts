import {
    parseAbi,
} from "viem";

export const marketFactoryAbi =
    parseAbi([
        "function marketCount() view returns (uint256)",
        "function getMarkets(uint256 offset, uint256 limit) view returns (address[])",
        "function isMarket(address addr) view returns (bool)",
    ]);

export const marketAbi =
    parseAbi([
        "function summary() view returns (string question, uint256 closeTime, uint8 currentOutcome, uint256 yesPriceWad, uint256 noPriceWad, uint256 totalCollateral, uint256 yesShares, uint256 noShares, bool open, bool resolved)",
        "function info() view returns (string question, uint256 closeTime, uint256 createdAt, address creator)",
        "function oracle() view returns (address)",
        "function feeBps() view returns (uint256)",
        "function noPrice() view returns (uint256)",

        "event SharesBought(address indexed buyer, bool isYes, uint256 usdcIn, uint256 feeCharged, uint256 sharesOut, uint256 yesPriceAfter)",
        "event SharesSold(address indexed seller, bool isYes, uint256 sharesIn, uint256 usdcOut, uint256 feeCharged, uint256 yesPriceAfter)",
    ]);