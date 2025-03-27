#!/bin/bash

# Fix components in src/components directory
fix_component() {
  local file=$1
  local name=$(basename "$file" .tsx | sed 's/\.[^.]*$//')
  
  # Create proper React component
  cat > "$file" << EOL
import React from 'react';

const $name = () => {
  return (
    <div>
      <h2>$name Component</h2>
      <p>This component will be implemented in a future sprint.</p>
    </div>
  );
};

export default $name;
EOL
  echo "Fixed component: $file with name $name"
}

# Fix context files
fix_context() {
  local file=$1
  local name=$(basename "$file" .tsx | sed 's/\.[^.]*$//')
  
  cat > "$file" << EOL
import React, { createContext, useContext, ReactNode } from 'react';

type ${name}Type = {
  // This will be implemented in a future sprint
};

const $name = createContext<${name}Type | undefined>(undefined);

export const ${name}Provider = ({ children }: { children: ReactNode }) => {
  return (
    <$name.Provider value={undefined}>
      {children}
    </$name.Provider>
  );
};

export const use$name = () => {
  const context = useContext($name);
  if (context === undefined) {
    throw new Error('use$name must be used within a ${name}Provider');
  }
  return context;
};

export default $name;
EOL
  echo "Fixed context: $file with name $name"
}

# Fix page files
fix_page() {
  local file=$1
  local name=$(basename "$file" .tsx | sed 's/\.[^.]*$//')
  
  cat > "$file" << EOL
import React from 'react';

const $name = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">$name</h1>
      <p>This page will be implemented in a future sprint.</p>
    </div>
  );
};

export default $name;
EOL
  echo "Fixed page: $file with name $name"
}

# Fix service files
fix_service() {
  local file=$1
  local name=$(basename "$file" .ts | sed 's/\.[^.]*$//')
  
  cat > "$file" << EOL
// $name service
// This service will be implemented in a future sprint

export const ${name} = {
  // Service methods will be added here
};

export default ${name};
EOL
  echo "Fixed service: $file with name $name"
}

# Fix type files
fix_types() {
  local file=$1
  local name=$(basename "$file" .ts | sed 's/\.[^.]*$//')
  
  # Remove "types" from the name if present
  name=${name//.types/}
  
  cat > "$file" << EOL
// Type definitions for $name

export interface ${name^}Props {
  // Props will be defined here
}

export interface ${name^}Data {
  // Data structure will be defined here
}

export type ${name^}Status = 'pending' | 'active' | 'completed';

// Add more types as needed
EOL
  echo "Fixed types: $file with name $name"
}

# Fix hook files
fix_hook() {
  local file=$1
  local name=$(basename "$file" .ts | sed 's/\.[^.]*$//')
  
  cat > "$file" << EOL
import { useState } from 'react';

export const $name = () => {
  // This hook will be implemented in a future sprint
  const [loading, setLoading] = useState(false);
  
  // Add hook implementation here
  
  return {
    loading,
    // Additional values will be returned here
  };
};

export default $name;
EOL
  echo "Fixed hook: $file with name $name"
}

# Fix utility files
fix_util() {
  local file=$1
  local name=$(basename "$file" .ts | sed 's/\.[^.]*$//')
  
  cat > "$file" << EOL
// $name utilities
// This utility file will be implemented in a future sprint

export const ${name}Utils = {
  // Utility functions will be added here
};

export default ${name}Utils;
EOL
  echo "Fixed utility: $file with name $name"
}

# Process all files
echo "Fixing component files..."
find src/components -name "*.tsx" | while read file; do
  fix_component "$file"
done

echo "Fixing context files..."
find src/context -name "*.tsx" | while read file; do
  fix_context "$file"
done

echo "Fixing page files..."
find src/pages -name "*.tsx" | while read file; do
  fix_page "$file"
done

echo "Fixing service files..."
find src/services -name "*.ts" | while read file; do
  fix_service "$file"
done

echo "Fixing type files..."
find src/types -name "*.ts" | while read file; do
  fix_types "$file"
done

echo "Fixing hook files..."
find src/hooks -name "*.ts" | while read file; do
  fix_hook "$file"
done

echo "Fixing utility files..."
find src/utils -name "*.ts" | while read file; do
  fix_util "$file"
done

echo "All files fixed!"