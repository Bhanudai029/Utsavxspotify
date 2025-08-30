import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Music, User } from 'lucide-react';
import type { TabName, NavItem } from '../types';

// Custom Friends icon component using the image
const FriendsIcon = ({ size = 34, isActive = false }: { size?: number; isActive?: boolean }) => (
  <img 
    src="/friends.png" 
    alt="Friends" 
    style={{ 
      width: size, 
      height: size,
      filter: isActive ? 'brightness(0) saturate(100%) invert(64%) sepia(59%) saturate(1388%) hue-rotate(95deg) brightness(103%) contrast(101%)' : 'brightness(0) saturate(100%) invert(70%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(103%) contrast(103%)'
    }}
    className="object-contain"
  />
);

const navItems: NavItem[] = [
  { name: 'Home', icon: Home, path: '/home' },
  { name: 'Friends', icon: FriendsIcon, path: '/friends' },
  { name: 'Music', icon: Music, path: '/music' },
  { name: 'Profile', icon: User, path: '/profile' },
];

const BottomNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // SIMPLE: Just one number to control desktop positioning
  const desktopOffset = 745; // <-- EDIT ONLY THIS NUMBER!
  
  // Specific positioning for 1194x904 resolution (friend's laptop)
  const getMarginLeft = () => {
    if (window.innerWidth >= 768) {
      // Check for specific 1194x904 resolution
      if (window.innerWidth === 1194 && window.innerHeight === 904) {
        return `${desktopOffset - 356}px`; // Move 70px left for this specific resolution
      }
      return `${desktopOffset}px`; // Default for other desktop screens
    }
    return 'auto'; // Mobile screens
  };
  
  const getActiveTab = (): TabName => {
    const path = location.pathname;
    
    // Special cases: favourite-songs should be considered part of Music section
    if (path === '/favourite-songs') {
      return 'Music';
    }
    
    const activeItem = navItems.find(item => item.path === path);
    return activeItem?.name || 'Home';
  };
  
  const activeTab = getActiveTab();
  
  return (
    <motion.nav 
      className="fixed bottom-0 left-0 right-0 bg-spotify-black border-t border-spotify-gray px-4 py-2"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div 
        className="flex justify-around items-center max-w-md mx-auto"
        style={{
          marginLeft: getMarginLeft()
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.name;
          
          return (
            <motion.button
              key={item.name}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center py-2 px-4 relative"
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                animate={{
                  color: isActive ? '#1DB954' : '#b3b3b3',
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ duration: 0.2 }}
              >
                {item.name === 'Friends' ? (
                  <Icon size={34} isActive={isActive} />
                ) : (
                  <Icon size={24} />
                )}
              </motion.div>
              <motion.span 
                className="text-xs mt-1 font-medium"
                animate={{
                  color: isActive ? '#1DB954' : '#b3b3b3',
                }}
                transition={{ duration: 0.2 }}
              >
                {item.name}
              </motion.span>
              {isActive && (
                <motion.div
                  className="absolute -top-1 left-1/2 w-1 h-1 bg-spotify-green rounded-full"
                  initial={{ scale: 0, x: '-50%' }}
                  animate={{ scale: 1, x: '-50%' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  layoutId="activeIndicator"
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
};

export default BottomNavigation;