const Hero = () => {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gray-950">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop")' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950/50 to-gray-950" />

      {/* Content */}
      <div className="relative z-10 text-center px-4">
        <span className="inline-block py-1 px-3 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium mb-4 border border-blue-500/20">
          Welcome to the Future
        </span>
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
          Experience <span className="text-blue-500">PIHU OS</span>
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-8">
          The AI-native desktop layer designed to make your computer feel intelligent, seamless, and uniquely yours.
        </p>
        <div className="flex gap-4 justify-center">
          <button className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all">
            Get Started
          </button>
          <button className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium border border-white/10 transition-all">
            Learn More
          </button>
        </div>
      </div>
    </div>
  );
};

export default Hero;
