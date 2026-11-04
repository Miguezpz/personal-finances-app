/**
 * Framer Motion feature bundle, loaded asynchronously by <MotionProvider> (research R8): it lands in its own
 * chunk after hydration, so it never counts toward First Load JS (SC-006).
 */
import { domAnimation } from "framer-motion";

export default domAnimation;
