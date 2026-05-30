def two_sum(nums, target):
    seen = {}
    for index, value in enumerate(nums):
        other = target - value
        if other in seen:
            return [seen[other], index]
        seen[value] = index
    return []


if __name__ == "__main__":
    print(two_sum([2, 7, 11, 15], 9))
