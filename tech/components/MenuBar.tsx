import React from 'react';

interface MenuBarProps {
    children: React.ReactNode;
    orientation: 'horizontal' | 'vertical';
}

const MenuBar: React.FC<MenuBarProps> = ({ children, orientation }) => {
    const orientationClasses = orientation === 'horizontal'
        ? 'flex-row items-center space-x-1'
        : 'flex-col items-stretch space-y-1 p-2 bg-gray-800 h-full';

    return (
        <nav className={`flex ${orientationClasses}`} role="menubar">
            {children}
        </nav>
    );
};

export default MenuBar;