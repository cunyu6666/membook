"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"

export function ShimmeringText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const characters = useMemo(() => text.split(""), [text])

  return (
    <div className={className}>
      {characters.map((char, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0.2 }}
          animate={{
            opacity: 1,
            transition: { delay: index * 0.01 },
          }}
        >
          {char}
        </motion.span>
      ))}
    </div>
  )
}
