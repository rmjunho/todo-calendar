/* @ds-bundle: {"format":4,"namespace":"IOS26DesignSystem_75cbb0","components":[{"name":"Button","sourcePath":"components/buttons/Button.jsx"},{"name":"PickerButton","sourcePath":"components/buttons/PickerButton.jsx"},{"name":"Switch","sourcePath":"components/controls/Switch.jsx"},{"name":"Icon","sourcePath":"components/foundation/Icon.jsx"},{"name":"ActionSheet","sourcePath":"components/overlays/ActionSheet.jsx"},{"name":"Alert","sourcePath":"components/overlays/Alert.jsx"},{"name":"ColorPicker","sourcePath":"components/pickers/ColorPicker.jsx"}],"sourceHashes":{"components/buttons/Button.jsx":"12d1826d4cca","components/buttons/PickerButton.jsx":"aaecc7db1d45","components/controls/Switch.jsx":"3892e437f581","components/foundation/Icon.jsx":"24cba0eca974","components/overlays/ActionSheet.jsx":"da09b9c669fa","components/overlays/Alert.jsx":"0529e3934ea8","components/pickers/ColorPicker.jsx":"13196e7d3f7a","ui_kits/ios/ControlCenter.jsx":"778d9c8c84a7","ui_kits/ios/HomeScreen.jsx":"0e4ca765f2e0"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.IOS26DesignSystem_75cbb0 = window.IOS26DesignSystem_75cbb0 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/controls/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/*
 * Switch — iOS toggle. 51×31pt track, 27pt knob, capsule shape.
 * On = tint fill (systemGreen by default, matching the source spec),
 * knob slides right with a subtle spring. Off = neutral fill.
 */
function Switch({
  checked = false,
  onChange,
  disabled = false,
  tint = "var(--system-green)",
  size = "medium",
  style,
  ...rest
}) {
  const scale = size === "small" ? 0.8 : 1;
  const W = 51 * scale;
  const H = 31 * scale;
  const knob = 27 * scale;
  const inset = (H - knob) / 2;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    role: "switch",
    "aria-checked": checked,
    disabled: disabled,
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      position: "relative",
      width: `${W}px`,
      height: `${H}px`,
      flexShrink: 0,
      padding: 0,
      border: "none",
      borderRadius: "var(--radius-capsule)",
      background: checked ? tint : "var(--fill)",
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transition: "background var(--duration-base) var(--ease-standard)",
      WebkitTapHighlightColor: "transparent",
      verticalAlign: "middle",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: `${inset}px`,
      left: `${inset}px`,
      width: `${knob}px`,
      height: `${knob}px`,
      borderRadius: "50%",
      background: "#ffffff",
      boxShadow: "0 3px 8px rgba(0,0,0,0.15), 0 1px 1px rgba(0,0,0,0.16)",
      transform: checked ? `translateX(${W - knob - inset * 2}px)` : "translateX(0)",
      transition: "transform var(--duration-base) var(--ease-spring)"
    }
  }));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/Switch.jsx", error: String((e && e.message) || e) }); }

// components/foundation/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/*
 * Icon — SF-Symbols-style glyph set.
 *
 * SUBSTITUTION NOTICE: Apple's SF Symbols are a proprietary, licensed
 * glyph library and cannot be redistributed. These are original,
 * hand-tuned SVG stand-ins drawn to match the SF Symbols 7 aesthetic
 * (rounded joins, optically centered, filled/hairline mix). Swap for the
 * real SF Symbols in a native Apple context. See readme.md → Iconography.
 *
 * All glyphs are authored on a 24×24 grid and inherit `currentColor`.
 */

const PATHS = {
  // --- filled ---
  "play.fill": /*#__PURE__*/React.createElement("path", {
    d: "M7 5.2c0-1 1-1.5 1.8-1L18 9.1c.9.5.9 1.8 0 2.3L8.8 16.8c-.8.5-1.8 0-1.8-1V5.2Z"
  }),
  "pause.fill": /*#__PURE__*/React.createElement("path", {
    d: "M7 4.5h3v15H7zM14 4.5h3v15h-3z"
  }),
  "backward.fill": /*#__PURE__*/React.createElement("path", {
    d: "M11 6.3v4L18.5 5.5c.8-.5 1.8 0 1.8 1v11c0 1-1 1.5-1.8 1L11 13.7v4c0 1-1 1.5-1.8 1l-6-4.5a1.2 1.2 0 0 1 0-2L9.2 5.3c.8-.5 1.8 0 1.8 1Z"
  }),
  "forward.fill": /*#__PURE__*/React.createElement("path", {
    d: "M13 6.3v4L5.5 5.5c-.8-.5-1.8 0-1.8 1v11c0 1 1 1.5 1.8 1L13 13.7v4c0 1 1 1.5 1.8 1l6-4.5a1.2 1.2 0 0 0 0-2L14.8 5.3c-.8-.5-1.8 0-1.8 1Z"
  }),
  "checkmark": /*#__PURE__*/React.createElement("path", {
    d: "M5 12.5l4.2 4.3L19 7",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }),
  "xmark": /*#__PURE__*/React.createElement("path", {
    d: "M6 6l12 12M18 6L6 18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round"
  }),
  "plus": /*#__PURE__*/React.createElement("path", {
    d: "M12 5v14M5 12h14",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round"
  }),
  "minus": /*#__PURE__*/React.createElement("path", {
    d: "M5 12h14",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round"
  }),
  "chevron.up": /*#__PURE__*/React.createElement("path", {
    d: "M6 15l6-6 6 6",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }),
  "chevron.down": /*#__PURE__*/React.createElement("path", {
    d: "M6 9l6 6 6-6",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }),
  "chevron.right": /*#__PURE__*/React.createElement("path", {
    d: "M9 6l6 6-6 6",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }),
  "chevron.left": /*#__PURE__*/React.createElement("path", {
    d: "M15 6l-6 6 6 6",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }),
  "chevron.up.chevron.down": /*#__PURE__*/React.createElement("g", {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8 10l4-4 4 4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 14l4 4 4-4"
  })),
  "chevron.compact.up": /*#__PURE__*/React.createElement("path", {
    d: "M5 14l7-4 7 4",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }),
  "magnifyingglass": /*#__PURE__*/React.createElement("g", {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.1",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "6.2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M15.6 15.6L20 20"
  })),
  "ellipsis": /*#__PURE__*/React.createElement("g", {
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "5",
    cy: "12",
    r: "1.7"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "1.7"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "19",
    cy: "12",
    r: "1.7"
  })),
  // --- control center / status ---
  "wifi": /*#__PURE__*/React.createElement("g", {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 9.5a12 12 0 0 1 16 0"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 13a8 8 0 0 1 10 0"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 16.4a3.4 3.4 0 0 1 4 0"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "19",
    r: "0.4",
    fill: "currentColor",
    stroke: "none"
  })),
  "antenna.radiowaves.left.and.right": /*#__PURE__*/React.createElement("g", {
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "10.8",
    y: "9",
    width: "2.4",
    height: "10",
    rx: "1.2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6.5 5.8a6.5 6.5 0 0 0 0 8.9",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M17.5 5.8a6.5 6.5 0 0 1 0 8.9",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 3.4a10 10 0 0 0 0 13.7",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M20 3.4a10 10 0 0 1 0 13.7",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round"
  })),
  "airplane": /*#__PURE__*/React.createElement("path", {
    d: "M20.4 13.1L14 11.6V6.4c0-1.1-.8-2.4-2-2.4s-2 1.3-2 2.4v5.2l-6.4 1.5c-.4.1-.6.4-.6.8v1.1c0 .3.3.6.7.5L10 14.7v3.1l-1.9 1.3c-.2.1-.3.3-.3.5v.8c0 .3.2.4.5.4L12 20.4l3.7.4c.3 0 .5-.1.5-.4v-.8c0-.2-.1-.4-.3-.5L14 17.8v-3.1l5.9 1.2c.4.1.7-.2.7-.5v-1.1c0-.4-.2-.7-.6-.8Z"
  }),
  "moon.fill": /*#__PURE__*/React.createElement("path", {
    d: "M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5Z"
  }),
  "sun.max.fill": /*#__PURE__*/React.createElement("g", {
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "4.2"
  }), /*#__PURE__*/React.createElement("g", {
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 2.6v2.4M12 19v2.4M2.6 12h2.4M19 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7"
  }))),
  "speaker.wave.2.fill": /*#__PURE__*/React.createElement("g", {
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 9.5h3l4-3.3c.7-.5 1.5 0 1.5.8v9.9c0 .8-.8 1.3-1.5.8L7 14.5H4c-.5 0-1-.4-1-1v-3c0-.6.5-1 1-1Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M15.5 8.5a5 5 0 0 1 0 7",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M18 6.5a8 8 0 0 1 0 11",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  })),
  "lock.fill": /*#__PURE__*/React.createElement("g", {
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "10.5",
    width: "14",
    height: "10",
    rx: "2.6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 10.5V8a4 4 0 0 1 8 0v2.5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  })),
  "lock.rotation": /*#__PURE__*/React.createElement("g", {
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "6",
    y: "11",
    width: "12",
    height: "8.5",
    rx: "2.4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 11V8.6a3 3 0 0 1 6 0V11",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8"
  })),
  "flashlight.on.fill": /*#__PURE__*/React.createElement("g", {
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8 3h8l-.7 3.2c-.1.5-.5.8-1 .8H9.7c-.5 0-.9-.3-1-.8L8 3Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9.6 8h4.8l-.5 11.6c0 .8-.6 1.4-1.4 1.4h-1c-.8 0-1.4-.6-1.4-1.4L9.6 8Z"
  })),
  "timer": /*#__PURE__*/React.createElement("g", {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "13.5",
    r: "7.3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 13.5V9.5M9.5 3h5"
  })),
  "camera.fill": /*#__PURE__*/React.createElement("g", {
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 8.5c0-1.1.9-2 2-2h1.6l1-1.7c.2-.3.5-.5.9-.5h5c.4 0 .7.2.9.5l1 1.7H19c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2v-8Z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12.5",
    r: "3.4",
    fill: "#000"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12.5",
    r: "2.6",
    fill: "currentColor"
  })),
  "calculator": /*#__PURE__*/React.createElement("g", {
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "3",
    width: "14",
    height: "18",
    rx: "3"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "7.5",
    y: "5.5",
    width: "9",
    height: "3.2",
    rx: "1",
    fill: "#000",
    opacity: "0.55"
  }), /*#__PURE__*/React.createElement("g", {
    fill: "#000",
    opacity: "0.55"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "8.5",
    cy: "12.5",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12.5",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "15.5",
    cy: "12.5",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8.5",
    cy: "16.5",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "16.5",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "15.5",
    cy: "16.5",
    r: "1.1"
  }))),
  "airplayaudio": /*#__PURE__*/React.createElement("g", {
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.5l-4.5-6-4.5 6H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
    opacity: "0.9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 15l4 5H8l4-5Z"
  })),
  "eyedropper.halffull": /*#__PURE__*/React.createElement("path", {
    d: "M18.9 4.1a2.6 2.6 0 0 0-3.7 0l-1.6 1.6-.7-.7-1.4 1.4.9.9-7 7c-.3.3-.5.7-.5 1.1L4 20l3.6-.4c.4 0 .8-.2 1.1-.5l7-7 .9.9 1.4-1.4-.7-.7 1.6-1.6a2.6 2.6 0 0 0 0-3.7Z",
    fill: "currentColor"
  }),
  "paintpalette.fill": /*#__PURE__*/React.createElement("path", {
    d: "M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-1.8 0-.5-.3-.9-.6-1.3-.3-.4-.4-.7-.4-1.1 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5c0-4-4-7.3-9-7.3Z",
    fill: "currentColor"
  }),
  "circle.fill": /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "8",
    fill: "currentColor"
  }),
  "app.fill": /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "4",
    width: "16",
    height: "16",
    rx: "4.6",
    fill: "currentColor"
  }),
  "heart.fill": /*#__PURE__*/React.createElement("path", {
    d: "M12 20s-7-4.4-9.2-8.7C1.4 8.5 2.6 5.4 5.6 5c1.9-.2 3.4.9 4.4 2.3C11 5.9 12.5 4.8 14.4 5c3 .4 4.2 3.5 2.8 6.3C15 15.6 12 20 12 20Z",
    fill: "currentColor"
  }),
  "bell.fill": /*#__PURE__*/React.createElement("path", {
    d: "M12 3c-3 0-5 2.2-5 5.3 0 4-1.5 5.3-2.3 6.2-.5.5-.2 1.3.5 1.3h13.6c.7 0 1-.8.5-1.3-.8-.9-2.3-2.2-2.3-6.2C17 5.2 15 3 12 3ZM9.5 18.5a2.6 2.6 0 0 0 5 0Z",
    fill: "currentColor"
  })
};
function Icon({
  name,
  size = 22,
  weight = "regular",
  color,
  style,
  className,
  ...rest
}) {
  const glyph = PATHS[name];
  const strokeScale = {
    light: 0.85,
    regular: 1,
    semibold: 1.15,
    bold: 1.3
  }[weight] || 1;
  return /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    role: "img",
    "aria-label": name,
    className: className,
    style: {
      display: "inline-block",
      verticalAlign: "middle",
      color: color || "currentColor",
      flexShrink: 0,
      ...style
    }
  }, rest), glyph || /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "4",
    width: "16",
    height: "16",
    rx: "4",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/foundation/Icon.jsx", error: String((e && e.message) || e) }); }

// components/buttons/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/*
 * Button — iOS 26 button. Covers the source's button specs:
 *   • Content-Area button   → variant="prominent" with a leading icon
 *   • Liquid Glass · Text   → variant="glass" (capsule)
 *   • Liquid Glass · Symbol → variant="glass" iconOnly shape="circle"
 */

const SIZES = {
  small: {
    h: 34,
    px: 14,
    font: "var(--text-subheadline-size)",
    gap: 5,
    icon: 15
  },
  medium: {
    h: 44,
    px: 18,
    font: "var(--text-body-size)",
    gap: 6,
    icon: 18
  },
  large: {
    h: 50,
    px: 22,
    font: "var(--text-headline-size)",
    gap: 8,
    icon: 20
  }
};
function Button({
  children,
  variant = "prominent",
  size = "medium",
  shape = "capsule",
  tint = "var(--tint)",
  icon,
  iconTrailing,
  iconOnly = false,
  fullWidth = false,
  disabled = false,
  onClick,
  style,
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const s = SIZES[size] || SIZES.medium;
  const radius = shape === "circle" || shape === "capsule" ? "var(--radius-capsule)" : "var(--radius-md)";
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: `${s.gap}px`,
    height: `${s.h}px`,
    minWidth: iconOnly ? `${s.h}px` : `${s.h}px`,
    width: iconOnly ? `${s.h}px` : fullWidth ? "100%" : "auto",
    padding: iconOnly ? 0 : `0 ${s.px}px`,
    borderRadius: radius,
    border: "none",
    outline: "none",
    fontFamily: "var(--font-text)",
    fontSize: s.font,
    fontWeight: "var(--weight-semibold)",
    letterSpacing: "var(--text-body-tracking)",
    lineHeight: 1,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    WebkitTapHighlightColor: "transparent",
    transition: "transform var(--duration-fast) var(--ease-standard), background var(--duration-fast) var(--ease-standard), filter var(--duration-fast) var(--ease-standard)",
    transform: pressed && !disabled ? "scale(var(--press-scale))" : "scale(1)"
  };
  const variants = {
    prominent: {
      background: tint,
      color: "var(--on-tint)",
      filter: hover && !disabled ? "brightness(1.08)" : "none"
    },
    tinted: {
      background: "color-mix(in srgb, var(--tint) 15%, transparent)",
      color: tint,
      filter: hover && !disabled ? "brightness(1.05)" : "none"
    },
    gray: {
      background: "var(--fill-tertiary)",
      color: "var(--label)"
    },
    plain: {
      background: "transparent",
      color: tint,
      opacity: disabled ? 0.4 : hover ? 0.7 : 1
    },
    glass: {
      background: "var(--glass-fill)",
      color: "var(--label)",
      WebkitBackdropFilter: "blur(var(--blur-glass)) saturate(var(--backdrop-saturate))",
      backdropFilter: "blur(var(--blur-glass)) saturate(var(--backdrop-saturate))",
      boxShadow: "inset 0 1px 0 var(--glass-highlight), inset 0 0 0 0.5px var(--glass-border), var(--shadow-glass)"
    }
  };
  const vStyle = {
    ...variants[variant]
  };
  if (variant === "glass" && !disabled) {
    if (pressed) vStyle.background = "var(--glass-fill-pressed)";else if (hover) vStyle.background = "var(--glass-fill-hover)";
  }
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onClick: onClick,
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPressed(false);
    },
    onTouchStart: () => setPressed(true),
    onTouchEnd: () => setPressed(false),
    style: {
      ...base,
      ...vStyle,
      ...style
    }
  }, rest), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: s.icon,
    weight: "semibold"
  }), !iconOnly && children, iconOnly && !icon && children, iconTrailing && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconTrailing,
    size: s.icon,
    weight: "semibold"
  }));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/Button.jsx", error: String((e && e.message) || e) }); }

// components/buttons/PickerButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/*
 * PickerButton — iOS pop-up menu button. A compact control showing the
 * current selection with the up/down chevron affordance; tapping opens a
 * menu of options (iOS "Menu" / pull-down button pattern).
 */
function PickerButton({
  value,
  options = [],
  onChange,
  variant = "gray",
  size = "medium",
  tint = "var(--tint)",
  disabled = false,
  style,
  ...rest
}) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const close = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const H = size === "small" ? 34 : size === "large" ? 50 : 44;
  const opts = options.map(o => typeof o === "string" ? {
    label: o,
    value: o
  } : o);
  const current = opts.find(o => o.value === value);
  const surface = variant === "glass" ? {
    background: hover ? "var(--glass-fill-hover)" : "var(--glass-fill)",
    WebkitBackdropFilter: "blur(var(--blur-glass)) saturate(var(--backdrop-saturate))",
    backdropFilter: "blur(var(--blur-glass)) saturate(var(--backdrop-saturate))",
    boxShadow: "inset 0 1px 0 var(--glass-highlight), inset 0 0 0 0.5px var(--glass-border), var(--shadow-glass)",
    color: "var(--label)"
  } : {
    background: "var(--fill-tertiary)",
    color: "var(--label)"
  };
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      position: "relative",
      display: "inline-block",
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onClick: () => !disabled && setOpen(o => !o),
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: `${H}px`,
      padding: "0 12px 0 14px",
      borderRadius: "var(--radius-capsule)",
      border: "none",
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.4 : 1,
      fontFamily: "var(--font-text)",
      fontSize: "var(--text-body-size)",
      fontWeight: "var(--weight-semibold)",
      letterSpacing: "var(--text-body-tracking)",
      WebkitTapHighlightColor: "transparent",
      transition: "background var(--duration-fast) var(--ease-standard)",
      ...surface
    }
  }, rest), /*#__PURE__*/React.createElement("span", null, current ? current.label : "Select"), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron.up.chevron.down",
    size: 15,
    weight: "semibold",
    color: tint
  })), open && /*#__PURE__*/React.createElement("div", {
    role: "menu",
    style: {
      position: "absolute",
      top: `${H + 6}px`,
      left: 0,
      minWidth: "220px",
      padding: "6px",
      borderRadius: "var(--radius-lg)",
      background: "var(--material-thick)",
      WebkitBackdropFilter: "blur(var(--blur-thick)) saturate(var(--backdrop-saturate))",
      backdropFilter: "blur(var(--blur-thick)) saturate(var(--backdrop-saturate))",
      boxShadow: "inset 0 0 0 0.5px var(--separator), var(--shadow-3)",
      zIndex: 50,
      animation: "iosMenuIn var(--duration-fast) var(--ease-decelerate)"
    }
  }, opts.map(o => {
    const sel = o.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o.value,
      type: "button",
      role: "menuitemradio",
      "aria-checked": sel,
      onClick: () => {
        onChange && onChange(o.value);
        setOpen(false);
      },
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        height: "40px",
        padding: "0 10px",
        borderRadius: "var(--radius-sm)",
        border: "none",
        background: "transparent",
        color: "var(--label)",
        fontFamily: "var(--font-text)",
        fontSize: "var(--text-body-size)",
        cursor: "pointer",
        textAlign: "left"
      },
      onMouseEnter: e => e.currentTarget.style.background = "var(--fill-quaternary)",
      onMouseLeave: e => e.currentTarget.style.background = "transparent"
    }, /*#__PURE__*/React.createElement("span", null, o.label), sel && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "checkmark",
      size: 16,
      weight: "semibold",
      color: tint
    }));
  })), /*#__PURE__*/React.createElement("style", null, `@keyframes iosMenuIn{from{opacity:0;transform:translateY(-6px) scale(.96)}to{opacity:1;transform:none}}`));
}
Object.assign(__ds_scope, { PickerButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/PickerButton.jsx", error: String((e && e.message) || e) }); }

// components/overlays/ActionSheet.jsx
try { (() => {
/*
 * ActionSheet — iOS action sheet. A bottom-anchored stack of grouped
 * action buttons in a Liquid-Glass card, with an optional title/message
 * header and a separate Cancel button beneath. Roles: "destructive"
 * (red), "cancel" (bold, detached), "default" (tint).
 */
function ActionSheet({
  open = true,
  title,
  message,
  actions = [],
  cancelLabel = "Cancel",
  onClose
}) {
  if (!open) return null;
  const nonCancel = actions.filter(a => a.role !== "cancel");
  const handle = a => {
    if (a && a.onPress) a.onPress();
    if (onClose) onClose();
  };
  const rowColor = a => a.role === "destructive" ? "var(--system-red)" : "var(--tint)";
  const groupStyle = {
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    background: "var(--material-thick)",
    WebkitBackdropFilter: "blur(var(--blur-thick)) saturate(var(--backdrop-saturate))",
    backdropFilter: "blur(var(--blur-thick)) saturate(var(--backdrop-saturate))",
    boxShadow: "var(--shadow-2)"
  };
  return /*#__PURE__*/React.createElement("div", {
    onMouseDown: e => e.target === e.currentTarget && onClose && onClose(),
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      background: "rgba(0,0,0,0.2)",
      zIndex: 100,
      padding: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 420,
      width: "100%",
      margin: "0 auto",
      fontFamily: "var(--font-text)",
      animation: "iosSheetIn var(--duration-slow) var(--ease-decelerate)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: groupStyle
  }, (title || message) && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 16px 14px",
      textAlign: "center",
      borderBottom: "0.5px solid var(--separator)"
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-footnote-size)",
      fontWeight: "var(--weight-semibold)",
      color: "var(--label-secondary)",
      lineHeight: 1.3
    }
  }, title), message && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2,
      fontSize: "var(--text-footnote-size)",
      color: "var(--label-secondary)",
      lineHeight: 1.35
    }
  }, message)), nonCancel.map((a, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    type: "button",
    onClick: () => handle(a),
    style: {
      display: "block",
      width: "100%",
      height: "57px",
      border: "none",
      borderTop: i > 0 ? "0.5px solid var(--separator)" : "none",
      background: "transparent",
      color: rowColor(a),
      fontSize: "var(--text-title3-size)",
      fontWeight: a.role === "destructive" ? "var(--weight-regular)" : "var(--weight-regular)",
      fontFamily: "var(--font-text)",
      cursor: "pointer",
      WebkitTapHighlightColor: "transparent"
    },
    onMouseDown: e => e.currentTarget.style.background = "var(--fill-quaternary)",
    onMouseUp: e => e.currentTarget.style.background = "transparent",
    onMouseLeave: e => e.currentTarget.style.background = "transparent"
  }, a.label))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => handle({
      role: "cancel"
    }),
    style: {
      ...groupStyle,
      display: "block",
      width: "100%",
      height: "57px",
      marginTop: 8,
      border: "none",
      color: "var(--tint)",
      fontSize: "var(--text-title3-size)",
      fontWeight: "var(--weight-semibold)",
      fontFamily: "var(--font-text)",
      cursor: "pointer",
      WebkitTapHighlightColor: "transparent"
    }
  }, cancelLabel)), /*#__PURE__*/React.createElement("style", null, `@keyframes iosSheetIn{from{opacity:0;transform:translateY(60px)}to{opacity:1;transform:none}}`));
}
Object.assign(__ds_scope, { ActionSheet });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/ActionSheet.jsx", error: String((e && e.message) || e) }); }

// components/overlays/Alert.jsx
try { (() => {
/*
 * Alert — iOS centered alert dialog. ~270pt wide, blurred material
 * card, title + message, optional text fields, and stacked/side-by-side
 * action buttons. Two actions render side by side; 3+ stack vertically.
 * Button roles: "cancel" (bold), "destructive" (red), "default".
 */
function Alert({
  open = true,
  title,
  message,
  fields = [],
  actions = [],
  onClose
}) {
  if (!open) return null;
  const acts = actions.length ? actions : [{
    label: "OK",
    role: "cancel"
  }];
  const sideBySide = acts.length === 2 && fields.length === 0;
  const handle = a => {
    if (a.onPress) a.onPress();
    if (onClose) onClose();
  };
  const btnColor = a => a.role === "destructive" ? "var(--system-red)" : "var(--tint)";
  const btnWeight = a => a.role === "cancel" ? "var(--weight-semibold)" : "var(--weight-regular)";
  return /*#__PURE__*/React.createElement("div", {
    onMouseDown: e => e.target === e.currentTarget && onClose && onClose(),
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.2)",
      WebkitBackdropFilter: "blur(2px)",
      backdropFilter: "blur(2px)",
      zIndex: 100,
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "alertdialog",
    style: {
      width: "270px",
      maxWidth: "100%",
      borderRadius: "var(--radius-2xl)",
      overflow: "hidden",
      background: "var(--material-thick)",
      WebkitBackdropFilter: "blur(var(--blur-thick)) saturate(var(--backdrop-saturate))",
      backdropFilter: "blur(var(--blur-thick)) saturate(var(--backdrop-saturate))",
      boxShadow: "var(--shadow-3)",
      fontFamily: "var(--font-text)",
      animation: "iosAlertIn var(--duration-base) var(--ease-spring)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "19px 16px 14px",
      textAlign: "center"
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-headline-size)",
      fontWeight: "var(--weight-bold)",
      color: "var(--label)",
      lineHeight: 1.25
    }
  }, title), message && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 3,
      fontSize: "var(--text-footnote-size)",
      lineHeight: 1.35,
      color: "var(--label)"
    }
  }, message), fields.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, fields.map((f, i) => /*#__PURE__*/React.createElement("input", {
    key: i,
    placeholder: f.placeholder || "",
    type: f.secure ? "password" : "text",
    defaultValue: f.value,
    style: {
      height: 30,
      padding: "0 8px",
      borderRadius: "var(--radius-xs)",
      border: "0.5px solid var(--separator)",
      background: "var(--bg)",
      color: "var(--label)",
      fontSize: "13px",
      fontFamily: "var(--font-text)",
      outline: "none",
      width: "100%",
      boxSizing: "border-box"
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: sideBySide ? "row" : "column",
      borderTop: "0.5px solid var(--separator)"
    }
  }, acts.map((a, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    type: "button",
    onClick: () => handle(a),
    style: {
      flex: 1,
      height: "44px",
      border: "none",
      background: "transparent",
      color: btnColor(a),
      fontSize: "var(--text-body-size)",
      fontWeight: btnWeight(a),
      fontFamily: "var(--font-text)",
      cursor: "pointer",
      borderLeft: sideBySide && i > 0 ? "0.5px solid var(--separator)" : "none",
      borderTop: !sideBySide && i > 0 ? "0.5px solid var(--separator)" : "none",
      WebkitTapHighlightColor: "transparent"
    },
    onMouseDown: e => e.currentTarget.style.background = "var(--fill-quaternary)",
    onMouseUp: e => e.currentTarget.style.background = "transparent",
    onMouseLeave: e => e.currentTarget.style.background = "transparent"
  }, a.label)))), /*#__PURE__*/React.createElement("style", null, `@keyframes iosAlertIn{from{opacity:0;transform:scale(1.12)}to{opacity:1;transform:none}}`));
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/Alert.jsx", error: String((e && e.message) || e) }); }

// components/pickers/ColorPicker.jsx
try { (() => {
/*
 * ColorPicker — iPad color picker panel (iOS 26). A Liquid-Glass popover
 * with a segmented Grid / Spectrum / Sliders control, an eyedropper, an
 * opacity slider, and a live selection. Mirrors the source spec layout.
 */

const GRID = [["#000000", "#3b3b3b", "#606060", "#8e8e93", "#c7c7cc", "#ffffff"], ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#30b0c7", "#007aff"], ["#5856d6", "#af52de", "#ff2d55", "#a2845e", "#00c7be", "#32ade6"], ["#ffd5cf", "#ffe6c2", "#fff6c2", "#d6f5dd", "#cfeef5", "#cfe4ff"], ["#b30f06", "#b36800", "#b39200", "#1f7a3a", "#1f7a8c", "#0050b3"], ["#2a0a5e", "#4b1f7a", "#7a1f3d", "#5e3a1f", "#0a5e57", "#0a3a7a"]];
function Segmented({
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      padding: 2,
      borderRadius: "9px",
      background: "var(--fill-tertiary)",
      gap: 2
    }
  }, options.map(o => {
    const sel = o === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o,
      type: "button",
      onClick: () => onChange(o),
      style: {
        flex: 1,
        height: 30,
        border: "none",
        borderRadius: "7px",
        background: sel ? "var(--bg)" : "transparent",
        boxShadow: sel ? "var(--shadow-1)" : "none",
        color: "var(--label)",
        fontFamily: "var(--font-text)",
        fontSize: "13px",
        fontWeight: sel ? "var(--weight-semibold)" : "var(--weight-regular)",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent"
      }
    }, o);
  }));
}
function Slider({
  label,
  value,
  onChange,
  track,
  right
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 56,
      fontSize: 13,
      color: "var(--label-secondary)"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      flex: 1,
      height: 28,
      display: "flex",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: "auto 0",
      height: 28,
      borderRadius: 8,
      background: track,
      boxShadow: "inset 0 0 0 0.5px var(--separator)"
    }
  }), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    value: value,
    onChange: e => onChange(Number(e.target.value)),
    style: {
      position: "relative",
      width: "100%",
      margin: 0,
      accentColor: "var(--tint)",
      background: "transparent",
      WebkitAppearance: "none",
      appearance: "none"
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 42,
      textAlign: "right",
      fontSize: 13,
      color: "var(--label)",
      fontVariantNumeric: "tabular-nums"
    }
  }, right));
}
function ColorPicker({
  value = "#007aff",
  onChange,
  opacity = 100,
  onOpacityChange,
  onClose,
  style
}) {
  const [tab, setTab] = React.useState("Grid");
  const [color, setColor] = React.useState(value);
  const [op, setOp] = React.useState(opacity);
  React.useEffect(() => setColor(value), [value]);
  const pick = c => {
    setColor(c);
    onChange && onChange(c);
  };
  const setOpacity = v => {
    setOp(v);
    onOpacityChange && onOpacityChange(v);
  };
  const hexToRgb = h => {
    const n = parseInt(h.replace("#", ""), 16);
    return h.length >= 7 ? {
      r: n >> 16 & 255,
      g: n >> 8 & 255,
      b: n & 255
    } : {
      r: 0,
      g: 122,
      b: 255
    };
  };
  const rgb = hexToRgb(color);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 320,
      borderRadius: "var(--radius-xl)",
      background: "var(--material-thick)",
      WebkitBackdropFilter: "blur(var(--blur-thick)) saturate(var(--backdrop-saturate))",
      backdropFilter: "blur(var(--blur-thick)) saturate(var(--backdrop-saturate))",
      boxShadow: "inset 0 0 0 0.5px var(--separator), var(--shadow-3)",
      fontFamily: "var(--font-text)",
      overflow: "hidden",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 14px 6px"
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    title: "Eyedropper",
    style: {
      border: "none",
      background: "transparent",
      padding: 4,
      cursor: "pointer",
      color: "var(--label)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "eyedropper.halffull",
    size: 22
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-headline-size)",
      fontWeight: "var(--weight-bold)",
      color: "var(--label)"
    }
  }, "Colors"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    title: "Close",
    style: {
      border: "none",
      background: "var(--fill-tertiary)",
      borderRadius: "50%",
      width: 28,
      height: 28,
      display: "grid",
      placeItems: "center",
      cursor: "pointer",
      color: "var(--label-secondary)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "xmark",
    size: 13,
    weight: "bold"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "6px 14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Segmented, {
    value: tab,
    onChange: setTab,
    options: ["Grid", "Spectrum", "Sliders"]
  }), tab === "Grid" && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(6,1fr)",
      gap: 8
    }
  }, GRID.flat().map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    type: "button",
    onClick: () => pick(c),
    style: {
      aspectRatio: "1",
      border: "none",
      borderRadius: "50%",
      cursor: "pointer",
      background: c,
      boxShadow: color.toLowerCase() === c.toLowerCase() ? "0 0 0 2px var(--bg), 0 0 0 4px var(--tint)" : "inset 0 0 0 0.5px rgba(0,0,0,0.15)"
    }
  }))), tab === "Spectrum" && /*#__PURE__*/React.createElement("div", {
    style: {
      height: 176,
      borderRadius: "var(--radius-md)",
      cursor: "crosshair",
      background: "linear-gradient(to right, #fff, rgba(255,255,255,0)), linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)",
      boxShadow: "inset 0 0 0 0.5px var(--separator)"
    }
  }), tab === "Sliders" && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Slider, {
    label: "Red",
    value: Math.round(rgb.r / 2.55),
    onChange: () => {},
    track: `linear-gradient(90deg, rgb(0,${rgb.g},${rgb.b}), rgb(255,${rgb.g},${rgb.b}))`,
    right: rgb.r
  }), /*#__PURE__*/React.createElement(Slider, {
    label: "Green",
    value: Math.round(rgb.g / 2.55),
    onChange: () => {},
    track: `linear-gradient(90deg, rgb(${rgb.r},0,${rgb.b}), rgb(${rgb.r},255,${rgb.b}))`,
    right: rgb.g
  }), /*#__PURE__*/React.createElement(Slider, {
    label: "Blue",
    value: Math.round(rgb.b / 2.55),
    onChange: () => {},
    track: `linear-gradient(90deg, rgb(${rgb.r},${rgb.g},0), rgb(${rgb.r},${rgb.g},255))`,
    right: rgb.b
  })), /*#__PURE__*/React.createElement(Slider, {
    label: "Opacity",
    value: op,
    onChange: setOpacity,
    right: `${op}%`,
    track: `linear-gradient(90deg, transparent, ${color}), repeating-conic-gradient(#c7c7cc 0% 25%, #fff 0% 50%) 50% / 12px 12px`
  })));
}
Object.assign(__ds_scope, { ColorPicker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/pickers/ColorPicker.jsx", error: String((e && e.message) || e) }); }

// ui_kits/ios/ControlCenter.jsx
try { (() => {
/* global React */
// ControlCenter — iOS 26 Control Center recreation (from the source spec).
const CCNS = window.IOS26DesignSystem_75cbb0;
const CCIcon = CCNS.Icon;
function Tile({
  children,
  style,
  onClick
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      borderRadius: 20,
      background: "var(--glass-fill)",
      WebkitBackdropFilter: "blur(24px) saturate(180%)",
      backdropFilter: "blur(24px) saturate(180%)",
      boxShadow: "inset 0 1px 0 var(--glass-highlight), inset 0 0 0 0.5px var(--glass-border)",
      padding: 14,
      color: "#fff",
      position: "relative",
      ...style
    }
  }, children);
}
function RoundToggle({
  icon,
  on,
  onColor,
  onClick,
  label
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    title: label,
    style: {
      width: 48,
      height: 48,
      borderRadius: "50%",
      border: "none",
      cursor: "pointer",
      background: on ? onColor || "var(--system-blue)" : "rgba(120,120,128,0.32)",
      color: "#fff",
      display: "grid",
      placeItems: "center",
      transition: "background 200ms var(--ease-standard)",
      WebkitTapHighlightColor: "transparent"
    }
  }, /*#__PURE__*/React.createElement(CCIcon, {
    name: icon,
    size: 22,
    weight: "semibold"
  }));
}
function VSlider({
  icon,
  value,
  onChange,
  tint
}) {
  const set = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const v = Math.max(0, Math.min(100, Math.round((1 - (e.clientY - r.top) / r.height) * 100)));
    onChange(v);
  };
  return /*#__PURE__*/React.createElement("div", {
    onClick: set,
    style: {
      position: "relative",
      width: "100%",
      height: "100%",
      minHeight: 150,
      borderRadius: 20,
      overflow: "hidden",
      cursor: "pointer",
      background: "var(--glass-fill)",
      WebkitBackdropFilter: "blur(24px)",
      backdropFilter: "blur(24px)",
      boxShadow: "inset 0 0 0 0.5px var(--glass-border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: `${value}%`,
      background: tint || "#fff",
      transition: "height 120ms linear"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 14,
      display: "grid",
      placeItems: "center",
      color: value > 18 ? "#000" : "#fff",
      mixBlendMode: value > 18 ? "normal" : "normal"
    }
  }, /*#__PURE__*/React.createElement(CCIcon, {
    name: icon,
    size: 22,
    weight: "semibold",
    color: value > 18 ? "#000" : "#fff"
  })));
}
function ControlCenter({
  onClose
}) {
  const [wifi, setWifi] = React.useState(true);
  const [bt, setBt] = React.useState(true);
  const [air, setAir] = React.useState(false);
  const [cell, setCell] = React.useState(true);
  const [dnd, setDnd] = React.useState(false);
  const [rot, setRot] = React.useState(false);
  const [bright, setBright] = React.useState(78);
  const [vol, setVol] = React.useState(60);
  const [playing, setPlaying] = React.useState(true);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 200,
      padding: "16px 12px",
      background: "rgba(0,0,0,0.28)",
      WebkitBackdropFilter: "blur(30px) saturate(160%)",
      backdropFilter: "blur(30px) saturate(160%)",
      fontFamily: "var(--font-text)",
      animation: "ccIn 350ms var(--ease-decelerate)",
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      color: "#fff",
      fontSize: 14,
      fontWeight: 600,
      padding: "0 8px"
    }
  }, /*#__PURE__*/React.createElement("span", null, "Apr 1 \xB7 9:41 AM"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 6,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(CCIcon, {
    name: "antenna.radiowaves.left.and.right",
    size: 15
  }), /*#__PURE__*/React.createElement(CCIcon, {
    name: "wifi",
    size: 15
  }), " 100%")), /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      gridAutoRows: 74,
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Tile, {
    style: {
      gridColumn: "span 2",
      gridRow: "span 2",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      placeItems: "center",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(RoundToggle, {
    icon: "airplane",
    on: air,
    onColor: "var(--system-orange)",
    onClick: () => setAir(!air),
    label: "Airplane Mode"
  }), /*#__PURE__*/React.createElement(RoundToggle, {
    icon: "antenna.radiowaves.left.and.right",
    on: cell,
    onColor: "var(--system-green)",
    onClick: () => setCell(!cell),
    label: "Cellular"
  }), /*#__PURE__*/React.createElement(RoundToggle, {
    icon: "wifi",
    on: wifi,
    onColor: "var(--system-blue)",
    onClick: () => setWifi(!wifi),
    label: "Wi-Fi"
  }), /*#__PURE__*/React.createElement(RoundToggle, {
    icon: "circle.fill",
    on: bt,
    onColor: "var(--system-blue)",
    onClick: () => setBt(!bt),
    label: "Bluetooth"
  })), /*#__PURE__*/React.createElement(Tile, {
    style: {
      gridColumn: "span 2",
      gridRow: "span 2",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 10,
      background: "linear-gradient(135deg,#ff6b9d,#7b5bff)",
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      overflow: "hidden"
    }
  }, "Track"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "rgba(255,255,255,0.7)"
    }
  }, "Artist")), /*#__PURE__*/React.createElement(CCIcon, {
    name: "airplayaudio",
    size: 18,
    style: {
      marginLeft: "auto"
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 4,
      borderRadius: 2,
      background: "rgba(255,255,255,0.3)",
      position: "relative",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: "42%",
      borderRadius: 2,
      background: "#fff"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      gap: 26,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(CCIcon, {
    name: "backward.fill",
    size: 22
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => setPlaying(!playing),
    style: {
      border: "none",
      background: "transparent",
      color: "#fff",
      cursor: "pointer",
      padding: 0
    }
  }, /*#__PURE__*/React.createElement(CCIcon, {
    name: playing ? "pause.fill" : "play.fill",
    size: 26
  })), /*#__PURE__*/React.createElement(CCIcon, {
    name: "forward.fill",
    size: 22
  })))), /*#__PURE__*/React.createElement(Tile, {
    onClick: () => setDnd(!dnd),
    style: {
      gridColumn: "span 2",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: "50%",
      background: dnd ? "var(--system-indigo)" : "rgba(120,120,128,0.32)",
      display: "grid",
      placeItems: "center",
      transition: "background 200ms"
    }
  }, /*#__PURE__*/React.createElement(CCIcon, {
    name: "moon.fill",
    size: 17
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 600
    }
  }, "Focus")), /*#__PURE__*/React.createElement(Tile, {
    onClick: () => setRot(!rot),
    style: {
      cursor: "pointer",
      display: "grid",
      placeItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: "50%",
      background: rot ? "var(--system-red)" : "rgba(120,120,128,0.32)",
      display: "grid",
      placeItems: "center",
      transition: "background 200ms"
    }
  }, /*#__PURE__*/React.createElement(CCIcon, {
    name: "lock.rotation",
    size: 20
  }))), /*#__PURE__*/React.createElement(Tile, {
    style: {
      display: "grid",
      placeItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: "50%",
      background: "rgba(120,120,128,0.32)",
      display: "grid",
      placeItems: "center"
    }
  }, /*#__PURE__*/React.createElement(CCIcon, {
    name: "camera.fill",
    size: 20
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "1",
      gridRow: "span 2"
    }
  }, /*#__PURE__*/React.createElement(VSlider, {
    icon: "sun.max.fill",
    value: bright,
    onChange: setBright
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "2",
      gridRow: "span 2"
    }
  }, /*#__PURE__*/React.createElement(VSlider, {
    icon: "speaker.wave.2.fill",
    value: vol,
    onChange: setVol
  })), /*#__PURE__*/React.createElement(Tile, {
    style: {
      gridColumn: "span 2",
      gridRow: "span 2",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "rgba(255,255,255,0.75)"
    }
  }, "Cupertino"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 40,
      fontWeight: 300,
      lineHeight: 1
    }
  }, "72\xB0")), /*#__PURE__*/React.createElement(CCIcon, {
    name: "sun.max.fill",
    size: 30,
    color: "var(--system-yellow)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "rgba(255,255,255,0.85)"
    }
  }, "Partly Cloudy \xB7 H:88\xB0 L:64\xB0")), [["flashlight.on.fill", "Flashlight"], ["timer", "Timer"], ["calculator", "Calculator"], ["camera.fill", "Camera"]].map(([ic, lb]) => /*#__PURE__*/React.createElement(Tile, {
    key: lb,
    style: {
      display: "grid",
      placeItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: "50%",
      background: "rgba(120,120,128,0.32)",
      display: "grid",
      placeItems: "center"
    }
  }, /*#__PURE__*/React.createElement(CCIcon, {
    name: ic,
    size: 20
  }))))), /*#__PURE__*/React.createElement("style", null, `@keyframes ccIn{from{opacity:0}to{opacity:1}}`));
}
window.ControlCenter = ControlCenter;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/ios/ControlCenter.jsx", error: String((e && e.message) || e) }); }

// ui_kits/ios/HomeScreen.jsx
try { (() => {
/* global React */
// HomeScreen — iOS 26 Home Screen recreation (from the source spec).
// App icons are stylized stand-ins: Apple's real app icons are
// proprietary and cannot be redistributed. See readme.md → Iconography.
const NS = window.IOS26DesignSystem_75cbb0;
const Icon = NS.Icon;
function AppIcon({
  label,
  children,
  bg,
  onClick,
  badge
}) {
  const [p, setP] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseDown: () => setP(true),
    onMouseUp: () => setP(false),
    onMouseLeave: () => setP(false),
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      border: "none",
      background: "transparent",
      cursor: "pointer",
      padding: 0,
      width: 76,
      WebkitTapHighlightColor: "transparent",
      transform: p ? "scale(0.9)" : "scale(1)",
      transition: "transform 140ms var(--ease-standard)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 60,
      height: 60
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 60,
      height: 60,
      borderRadius: 14,
      background: bg,
      display: "grid",
      placeItems: "center",
      boxShadow: "0 1px 3px rgba(0,0,0,0.25), inset 0 0 0 0.5px rgba(255,255,255,0.15)",
      overflow: "hidden",
      color: "#fff"
    }
  }, children), badge != null && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: -3,
      right: -3,
      minWidth: 20,
      height: 20,
      padding: "0 5px",
      borderRadius: 10,
      background: "var(--system-red)",
      color: "#fff",
      fontSize: 12,
      fontWeight: 700,
      display: "grid",
      placeItems: "center",
      boxShadow: "0 0 0 1.5px rgba(0,0,0,0.15)"
    }
  }, badge)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: "#fff",
      textShadow: "0 1px 3px rgba(0,0,0,0.5)",
      maxWidth: 76,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, label));
}

// Custom icon glyphs (CSS) for well-known apps
const CalIcon = () => /*#__PURE__*/React.createElement("div", {
  style: {
    width: 60,
    height: 60,
    background: "#fff",
    display: "flex",
    flexDirection: "column"
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    height: 15,
    background: "var(--system-red)",
    color: "#fff",
    fontSize: 8,
    fontWeight: 700,
    display: "grid",
    placeItems: "center",
    letterSpacing: 0.5
  }
}, "MON"), /*#__PURE__*/React.createElement("div", {
  style: {
    flex: 1,
    display: "grid",
    placeItems: "center",
    color: "#111",
    fontSize: 30,
    fontWeight: 300
  }
}, "14"));
const ClockIcon = () => /*#__PURE__*/React.createElement("div", {
  style: {
    width: 46,
    height: 46,
    borderRadius: "50%",
    background: "#fff",
    position: "relative",
    boxShadow: "inset 0 0 0 2px #111"
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 2,
    height: 16,
    background: "#111",
    transformOrigin: "bottom",
    transform: "translate(-50%,-100%) rotate(20deg)"
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 2,
    height: 11,
    background: "var(--system-orange)",
    transformOrigin: "bottom",
    transform: "translate(-50%,-100%) rotate(150deg)"
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "#111",
    transform: "translate(-50%,-50%)"
  }
}));
const PhotosIcon = () => /*#__PURE__*/React.createElement("div", {
  style: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "conic-gradient(#ffcc00,#ff9500,#ff2d55,#af52de,#5856d6,#32ade6,#34c759,#ffcc00)",
    filter: "saturate(1.1)"
  }
});
function HomeScreen({
  onOpenApp,
  onPullControlCenter
}) {
  const rows = [[{
    label: "FaceTime",
    bg: "linear-gradient(180deg,#4cd964,#34c759)",
    g: /*#__PURE__*/React.createElement(Icon, {
      name: "camera.fill",
      size: 30
    })
  }, {
    label: "Calendar",
    bg: "#fff",
    g: /*#__PURE__*/React.createElement(CalIcon, null),
    flush: true
  }, {
    label: "Photos",
    bg: "#fff",
    g: /*#__PURE__*/React.createElement(PhotosIcon, null)
  }, {
    label: "Camera",
    bg: "linear-gradient(180deg,#6e6e73,#3a3a3c)",
    g: /*#__PURE__*/React.createElement(Icon, {
      name: "camera.fill",
      size: 30
    })
  }], [{
    label: "Mail",
    bg: "linear-gradient(180deg,#3aa0ff,#007aff)",
    g: /*#__PURE__*/React.createElement(Icon, {
      name: "bell.fill",
      size: 0
    }),
    letter: "✉",
    badge: 3
  }, {
    label: "Clock",
    bg: "#000",
    g: /*#__PURE__*/React.createElement(ClockIcon, null),
    flush: true
  }, {
    label: "Reminders",
    bg: "#fff",
    g: /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 5
      }
    }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 7,
        height: 7,
        borderRadius: "50%",
        boxShadow: `inset 0 0 0 2px ${["#ff9500", "#ff3b30", "#007aff"][i]}`
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        width: 22,
        height: 2,
        background: "#d1d1d6",
        borderRadius: 2
      }
    }))))
  }, {
    label: "Maps",
    bg: "linear-gradient(180deg,#a0e57f,#5fce8f)",
    g: /*#__PURE__*/React.createElement("div", {
      style: {
        width: 60,
        height: 60,
        background: "conic-gradient(from 200deg,#cfeecf,#bfe3ff,#ffe0b3,#cfeecf)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 0,
        height: 0,
        margin: "22px auto",
        borderLeft: "7px solid transparent",
        borderRight: "7px solid transparent",
        borderTop: "12px solid #ff3b30"
      }
    })),
    flush: true
  }], [{
    label: "TV",
    bg: "#000",
    g: /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: -1
      }
    }, "tv")
  }, {
    label: "News",
    bg: "#fff",
    g: /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 34,
        fontWeight: 800,
        color: "var(--system-pink)",
        fontFamily: "Georgia,serif"
      }
    }, "N")
  }, {
    label: "App Store",
    bg: "linear-gradient(180deg,#2aa8ff,#0a84ff)",
    g: /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 30,
        fontWeight: 600
      }
    }, "A")
  }, {
    label: "Games",
    bg: "linear-gradient(135deg,#5856d6,#af52de)",
    g: /*#__PURE__*/React.createElement(Icon, {
      name: "app.fill",
      size: 26
    })
  }], [{
    label: "Health",
    bg: "#fff",
    g: /*#__PURE__*/React.createElement(Icon, {
      name: "heart.fill",
      size: 30,
      color: "var(--system-pink)"
    })
  }, {
    label: "Wallet",
    bg: "#111",
    g: /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        width: 38,
        height: 30
      }
    }, ["#ff3b30", "#ff9500", "#34c759"].map((c, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        position: "absolute",
        top: i * 6,
        left: 0,
        right: 0,
        height: 20,
        borderRadius: 4,
        background: c
      }
    })))
  }, {
    label: "Siri",
    bg: "#000",
    g: /*#__PURE__*/React.createElement("div", {
      style: {
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: "conic-gradient(#ff2d55,#ff9500,#5856d6,#32ade6,#ff2d55)"
      }
    })
  }, {
    label: "Settings",
    bg: "linear-gradient(180deg,#c7c7cc,#8e8e93)",
    g: /*#__PURE__*/React.createElement(Icon, {
      name: "timer",
      size: 32
    })
  }], [{
    label: "My App",
    bg: "linear-gradient(135deg,#007aff,#5856d6)",
    g: /*#__PURE__*/React.createElement(Icon, {
      name: "app.fill",
      size: 26
    })
  }]];
  const dock = [{
    label: "Phone",
    bg: "linear-gradient(180deg,#4cd964,#34c759)",
    g: /*#__PURE__*/React.createElement(Icon, {
      name: "antenna.radiowaves.left.and.right",
      size: 28
    })
  }, {
    label: "Safari",
    bg: "#fff",
    g: /*#__PURE__*/React.createElement(Icon, {
      name: "magnifyingglass",
      size: 30,
      color: "var(--system-blue)"
    })
  }, {
    label: "Messages",
    bg: "linear-gradient(180deg,#4cd964,#34c759)",
    g: /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 30
      }
    }, "\uD83D\uDCAC")
  }, {
    label: "Music",
    bg: "linear-gradient(180deg,#fb5c74,#fa2d48)",
    g: /*#__PURE__*/React.createElement(Icon, {
      name: "play.fill",
      size: 28
    })
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      background: "url('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=900&q=80') center/cover, linear-gradient(160deg,#1b2a4a,#3a1f5e)",
      fontFamily: "var(--font-text)",
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "14px 26px 4px",
      color: "#fff",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 600
    }
  }, "9:41"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "antenna.radiowaves.left.and.right",
    size: 17
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "wifi",
    size: 17
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 24,
      height: 12,
      borderRadius: 3,
      border: "1px solid rgba(255,255,255,.6)",
      padding: 1.5,
      display: "flex"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: "#fff",
      borderRadius: 1.5
    }
  })))), /*#__PURE__*/React.createElement("button", {
    onClick: onPullControlCenter,
    title: "Open Control Center",
    style: {
      position: "absolute",
      top: 8,
      right: 0,
      width: 90,
      height: 40,
      background: "transparent",
      border: "none",
      cursor: "pointer",
      zIndex: 5
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: "18px 14px 0",
      display: "flex",
      flexDirection: "column",
      gap: 20
    }
  }, rows.map((row, ri) => /*#__PURE__*/React.createElement("div", {
    key: ri,
    style: {
      display: "flex",
      justifyContent: "space-around"
    }
  }, row.map(a => /*#__PURE__*/React.createElement(AppIcon, {
    key: a.label,
    label: a.label,
    bg: a.bg,
    badge: a.badge,
    onClick: () => onOpenApp && onOpenApp(a.label)
  }, a.flush ? a.g : a.letter ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 28
    }
  }, a.letter) : a.g))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      gap: 7,
      padding: "6px 0 12px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: "#fff"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: "rgba(255,255,255,.4)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      paddingBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "7px 16px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.18)",
      WebkitBackdropFilter: "blur(20px)",
      backdropFilter: "blur(20px)",
      color: "#fff",
      fontSize: 15,
      fontWeight: 500
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "magnifyingglass",
    size: 15,
    weight: "semibold"
  }), " Search")), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "0 10px 14px",
      padding: "12px 8px",
      borderRadius: 34,
      background: "rgba(255,255,255,0.22)",
      WebkitBackdropFilter: "blur(30px) saturate(180%)",
      backdropFilter: "blur(30px) saturate(180%)",
      boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.4)",
      display: "flex",
      justifyContent: "space-around"
    }
  }, dock.map(a => /*#__PURE__*/React.createElement(AppIcon, {
    key: a.label,
    label: "",
    bg: a.bg,
    onClick: () => onOpenApp && onOpenApp(a.label)
  }, a.g))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      paddingBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 134,
      height: 5,
      borderRadius: 3,
      background: "rgba(255,255,255,0.85)"
    }
  })));
}
window.HomeScreen = HomeScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/ios/HomeScreen.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.PickerButton = __ds_scope.PickerButton;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.ActionSheet = __ds_scope.ActionSheet;

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.ColorPicker = __ds_scope.ColorPicker;

})();
