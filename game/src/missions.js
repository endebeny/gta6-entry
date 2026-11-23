// The story of Solmar Bay: four jobs for Rico, the garage owner who got the
// player out of trouble once and now collects. Each mission is a chain of
// steps with a waypoint; finishing one pays cash and unlocks the next.
export function createMissions(landmarks) {
  const M = landmarks;
  const missions = [
    {
      id: 'welcome',
      title: 'Welcome to Solmar',
      giver: 'Rico',
      briefing: 'Rico needs a driver at the Marina. Get a car and meet him there.',
      reward: 150,
      steps: [
        { text: 'Steal a car (walk up and press E)', target: null, needCar: true },
        { text: 'Drive to the Marina', target: { x: M.marina.x, z: M.marina.z, r: 10 } },
      ],
    },
    {
      id: 'pickup',
      title: 'The Pickup',
      giver: 'Rico',
      briefing: 'A package is waiting at the Docks. Bring it to the garage, no questions.',
      reward: 300,
      steps: [
        { text: 'Pick up the package at the Docks', target: { x: M.docks.x, z: M.docks.z, r: 8 } },
        { text: 'Deliver the package to Rico\'s Garage', target: { x: M.garage.x, z: M.garage.z, r: 9 } },
      ],
    },
    {
      id: 'hotwheels',
      title: 'Hot Wheels',
      giver: 'Rico',
      briefing: 'A red sports car is parked by the Plaza. Take it. The cops will not like it.',
      reward: 500,
      steps: [
        { text: 'Steal the red sports car at the Plaza', target: { x: M.plaza.x, z: M.plaza.z, r: 12 }, needSports: true },
        { text: 'Lose the heat and deliver it to the Garage', target: { x: M.garage.x, z: M.garage.z, r: 9 } },
      ],
    },
    {
      id: 'getaway',
      title: 'The Getaway',
      giver: 'Rico',
      briefing: 'The whole department is after you. Lose them, then vanish at the Hideout.',
      reward: 800,
      steps: [
        { text: 'Lose the cops (get your wanted level to 0)', target: null, needClean: true },
        { text: 'Reach the Hideout', target: { x: M.hideout.x, z: M.hideout.z, r: 10 } },
      ],
    },
  ];
  return {
    list: missions,
    index: 0,
    step: 0,
    done: [],
    complete: false,
    current() {
      return missions[this.index] || null;
    },
    currentStep() {
      const m = this.current();
      return m ? m.steps[this.step] : null;
    },
    objectiveText() {
      if (this.complete) return 'Story complete — Solmar Bay is yours. Free roam!';
      const m = this.current();
      const s = this.currentStep();
      return m && s ? `${m.title}: ${s.text}` : '';
    },
    // Returns the waypoint of the current step, or null.
    waypoint() {
      const s = this.currentStep();
      return s && s.target ? s.target : null;
    },
    // Advance one step; returns 'mission' when a mission finishes, 'story' at the end.
    advance(world) {
      const m = this.current();
      if (!m) return null;
      this.step += 1;
      if (this.step >= m.steps.length) {
        this.done.push(m.id);
        world.cash += m.reward;
        this.index += 1;
        this.step = 0;
        if (this.index >= this.list.length) {
          this.complete = true;
          return 'story';
        }
        return 'mission';
      }
      return 'step';
    },
  };
}
