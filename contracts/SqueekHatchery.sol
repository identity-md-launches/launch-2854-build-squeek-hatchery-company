// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// @title Squeek Hatchery testnet companions (Sepolia only)
/// @notice Free mint. The caller supplies the portrait SVG and trait JSON that the website rendered
///         from a local incubation session. Caller-supplied art is NOT proof of a genuine hardware
///         session. Each session ID can be minted once in total. Stored art is immutable: there is
///         no owner, no setter and no upgrade path.
contract SqueekHatchery is ERC721 {
    /// SVG cap keeps one mint well below the 16,777,216 per-transaction gas cap (EIP-7825).
    uint256 public constant MAX_SVG_BYTES = 12_000;
    uint256 public constant MAX_TRAITS_BYTES = 1_500;
    uint256 public constant MAX_NAME_BYTES = 30;

    struct Companion {
        string name;
        string svg;
        string traits; // JSON array of OpenSea-style attributes
        bytes32 sessionId;
    }

    uint256 public nextTokenId = 1;
    mapping(uint256 => Companion) private companions;
    mapping(bytes32 => uint256) public tokenOfSession;

    error AlreadyMinted(bytes32 sessionId, uint256 tokenId);
    error InvalidName();
    error InvalidSvg();
    error InvalidTraits();
    error EmptySession();

    event Hatched(uint256 indexed tokenId, address indexed owner, bytes32 indexed sessionId, string name);

    constructor() ERC721("Squeek Hatchery", "HATCH") {}

    function mint(string calldata name, string calldata svg, string calldata traits, bytes32 sessionId)
        external
        returns (uint256 id)
    {
        if (sessionId == bytes32(0)) revert EmptySession();
        uint256 existing = tokenOfSession[sessionId];
        if (existing != 0) revert AlreadyMinted(sessionId, existing);
        _checkName(bytes(name));
        bytes memory s = bytes(svg);
        if (s.length < 64 || s.length > MAX_SVG_BYTES || !_startsWith(s, "<svg ")) revert InvalidSvg();
        bytes memory t = bytes(traits);
        if (t.length < 2 || t.length > MAX_TRAITS_BYTES || t[0] != "[" || t[t.length - 1] != "]") {
            revert InvalidTraits();
        }
        id = nextTokenId++;
        tokenOfSession[sessionId] = id;
        companions[id] = Companion(name, svg, traits, sessionId);
        _safeMint(msg.sender, id);
        emit Hatched(id, msg.sender, sessionId, name);
    }

    function companion(uint256 id) external view returns (Companion memory) {
        _requireOwned(id);
        return companions[id];
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        Companion storage c = companions[id];
        bytes memory json = abi.encodePacked(
            '{"name":"', c.name,
            '","description":"A Squeek Hatchery companion hatched on Sepolia testnet. The portrait and traits were supplied by the minting player; the incubation session is not independently verified.",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(c.svg)),
            '","attributes":', c.traits, "}"
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
    }

    /// Letters, digits, space and . , ' - only, so the name can sit inside JSON unescaped.
    function _checkName(bytes memory n) private pure {
        if (n.length == 0 || n.length > MAX_NAME_BYTES || n[0] == " " || n[n.length - 1] == " ") revert InvalidName();
        for (uint256 i; i < n.length; ++i) {
            bytes1 c = n[i];
            bool ok = (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c == " "
                || c == "." || c == "," || c == "'" || c == "-";
            if (!ok) revert InvalidName();
        }
    }

    function _startsWith(bytes memory a, bytes memory p) private pure returns (bool) {
        if (a.length < p.length) return false;
        for (uint256 i; i < p.length; ++i) if (a[i] != p[i]) return false;
        return true;
    }
}
