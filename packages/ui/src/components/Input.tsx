import React from "react";

export interface InputProps {
  value?: string;
  defaultValue?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
  className?: string;
  id?: string;
  name?: string;
}

export function Input({
  value,
  defaultValue,
  onChange,
  placeholder,
  disabled,
  type = "text",
  className,
  id,
  name,
}: InputProps): React.ReactElement {
  return (
    <input
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      type={type}
      className={className}
      id={id}
      name={name}
    />
  );
}
