function twoSum(nums, target) {
  const seen = new Map();

  for (let i = 0; i < nums.length; i += 1) {
    const other = target - nums[i];
    if (seen.has(other)) {
      return [seen.get(other), i];
    }
    seen.set(nums[i], i);
  }

  return [];
}

console.log(twoSum([2, 7, 11, 15], 9));
