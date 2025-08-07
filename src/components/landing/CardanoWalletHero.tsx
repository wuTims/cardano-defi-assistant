"use client";

import React, { useEffect, useRef } from "react";
import { motion, useMotionTemplate, useMotionValue, animate } from "framer-motion";
import { Wallet, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

// Utility function for cn
function cnUtil(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Button component
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? "span" : "button";
    return (
      <Comp
        className={cnUtil(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// Glow component
const glowVariants = cva("absolute w-full", {
  variants: {
    variant: {
      top: "top-0",
      above: "-top-[128px]",
      bottom: "bottom-0",
      below: "-bottom-[128px]",
      center: "top-[50%]",
    },
  },
  defaultVariants: {
    variant: "top",
  },
});

interface GlowProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof glowVariants> {}

const Glow = React.forwardRef<HTMLDivElement, GlowProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cnUtil(glowVariants({ variant }), className)}
      {...props}
    >
      <div
        className={cnUtil(
          "absolute left-1/2 h-[256px] w-[60%] -translate-x-1/2 scale-[2.5] rounded-[50%] bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.5)_10%,_rgba(59,130,246,0)_60%)] sm:h-[512px]",
          variant === "center" && "-translate-y-1/2",
        )}
      />
      <div
        className={cnUtil(
          "absolute left-1/2 h-[128px] w-[40%] -translate-x-1/2 scale-[2] rounded-[50%] bg-[radial-gradient(ellipse_at_center,_rgba(37,99,235,0.3)_10%,_rgba(37,99,235,0)_60%)] sm:h-[256px]",
          variant === "center" && "-translate-y-1/2",
        )}
      />
    </div>
  )
);
Glow.displayName = "Glow";

// Floating shapes component
const FloatingShape = ({ delay = 0, className = "" }: { delay?: number; className?: string }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotate: 0 }}
      animate={{ opacity: 1, y: 0, rotate: 360 }}
      transition={{
        duration: 20,
        delay,
        repeat: Infinity,
        ease: "linear",
      }}
      className={cnUtil(
        "absolute w-32 h-32 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-white/10",
        className
      )}
    />
  );
};

// Main hero component
interface CardanoWalletHeroProps {
  title?: string;
  subtitle?: string;
  description?: string;
  primaryButtonText?: string;
  secondaryButtonText?: string;
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
}

const CardanoWalletHero: React.FC<CardanoWalletHeroProps> = ({
  title = "Sync Your Cardano Wallet",
  subtitle = "Seamlessly",
  description = "Experience the future of Cardano wallet synchronization with our advanced, secure, and lightning-fast service. Connect, sync, and manage your ADA with confidence.",
  primaryButtonText = "Connect Wallet",
  secondaryButtonText = "Learn More",
  onPrimaryClick = () => console.log("Connect wallet clicked"),
  onSecondaryClick = () => console.log("Learn more clicked"),
}) => {
  const color = useMotionValue("#3b82f6");

  useEffect(() => {
    animate(color, ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#3b82f6"], {
      ease: "easeInOut",
      duration: 8,
      repeat: Infinity,
      repeatType: "loop",
    });
  }, [color]);

  const backgroundGradient = useMotionTemplate`radial-gradient(circle at 50% 50%, ${color}15 0%, transparent 50%)`;
  const borderGradient = useMotionTemplate`linear-gradient(135deg, ${color}40, transparent)`;

  return (
    <section className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Animated background gradient */}
      <motion.div
        style={{ background: backgroundGradient }}
        className="absolute inset-0 opacity-60"
      />

      {/* Floating shapes */}
      <FloatingShape delay={0} className="top-20 left-10" />
      <FloatingShape delay={2} className="top-40 right-20" />
      <FloatingShape delay={4} className="bottom-32 left-1/4" />
      <FloatingShape delay={6} className="bottom-20 right-1/3" />

      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Glow variant="center" className="opacity-30" />
      </div>

      {/* Main content */}
      <div className="relative z-10 container mx-auto px-4 py-20 flex flex-col items-center justify-center min-h-screen text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm mb-8"
        >
          <Shield className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-blue-300">Secure & Trusted</span>
        </motion.div>

        {/* Main heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-6"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
            <span className="bg-gradient-to-b from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
              {title}
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              {subtitle}
            </span>
          </h1>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="max-w-2xl text-lg md:text-xl text-muted-foreground mb-12 leading-relaxed"
        >
          {description}
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 mb-16"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              size="lg"
              onClick={onPrimaryClick}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25 px-8 py-4 text-lg font-semibold"
            >
              <Wallet className="w-5 h-5 mr-2" />
              {primaryButtonText}
            </Button>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              variant="outline"
              size="lg"
              onClick={onSecondaryClick}
              className="border-muted-foreground/20 hover:border-muted-foreground/40 px-8 py-4 text-lg"
            >
              {secondaryButtonText}
            </Button>
          </motion.div>
        </motion.div>

        {/* Feature highlights */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl"
        >
          {[
            { icon: Zap, title: "Lightning Fast", description: "Sync in seconds, not minutes" },
            { icon: Shield, title: "Bank-Grade Security", description: "Your keys, your crypto" },
            { icon: Wallet, title: "Multi-Wallet Support", description: "Connect any Cardano wallet" },
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1 + index * 0.1 }}
              className="flex flex-col items-center text-center p-6 rounded-xl bg-background/5 backdrop-blur-sm border border-white/5"
            >
              <feature.icon className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Bottom gradient overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </section>
  );
};

// Usage example
const CardanoWalletHeroDemo = () => {
  return (
    <CardanoWalletHero
      title="Sync Your Cardano Wallet"
      subtitle="Seamlessly"
      description="Experience the future of Cardano wallet synchronization with our advanced, secure, and lightning-fast service. Connect, sync, and manage your ADA with confidence."
      primaryButtonText="Connect Wallet"
      secondaryButtonText="Learn More"
      onPrimaryClick={() => alert("Connecting wallet...")}
      onSecondaryClick={() => alert("Learning more...")}
    />
  );
};

export default CardanoWalletHeroDemo;